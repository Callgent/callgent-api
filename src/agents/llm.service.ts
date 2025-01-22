import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import * as dot from 'dot';
import { Utils } from '../infras/libs/utils';
import { LlmCompletionEvent } from './events/llm-completion.event';

@Injectable()
export class LLMService {
  private templates: { [key: string]: dot.RenderFunction } = {};
  constructor(
    private readonly configService: ConfigService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    dot.templateSettings.strip = false;
    this.llmModels = this.configService.get('LLM_MODELS');
    if (this.llmModels[0] == '[')
      this.llmModels = JSON.parse(this.llmModels as string);
  }
  protected llmModels: string[] | string;
  private readonly logger = new Logger(LLMService.name);

  /**
   * single round request-response query
   *
   * @param template prompt template name
   * @param args  prompt args
   * @param args { parseSchema: "returning json schema", validate: "validate function to check generated json" }
   */
  @Transactional()
  async query<T>(
    template: string,
    args: { [key: string]: any },
    {
      bizKey,
      parseType = 'json',
      parseSchema,
      validate,
    }: {
      bizKey?: string;
      parseType?: 'json' | 'codeBlock';
      parseSchema?: T;
      validate?: (generated: T, retry: number) => boolean | void;
    },
  ): Promise<T> {
    const prompt = await this._prompt(template, args);

    let cache: string, llmModel: string;
    let notCached = this.configService.get('LLM_CACHE_ENABLE');
    if (notCached) {
      [cache, llmModel] = await this._llmCacheLoad(template, prompt);
      notCached = !cache;
    }

    let ret: T,
      llmResult = '',
      errorMessage = '';
    let [maxRetry, valid] = [3, undefined];
    for (let i = 0; i < maxRetry; i++) {
      try {
        ret = cache as T;
        if (!ret) {
          const promptExt = errorMessage
            ? `${prompt}\n\nPlease retry as you just made a mistake: ${errorMessage}`
            : prompt;
          const req: LLMRequest = {
            // messages: [{ role: 'user', content: prompt }],
            prompt: promptExt,
            stream: false,
            route: 'fallback',
            temperature: 0, // TODO
          };
          if (Array.isArray(this.llmModels)) req.models = this.llmModels;
          else req.model = this.llmModels;
          const resp = await this._completion(req);
          llmModel = resp.model;

          if (!resp?.choices?.length) {
            valid = false;
            errorMessage = `LLM service not available, error=${(resp as any)?.error?.message}`;
            break;
          }

          const choice = resp.choices[0] as NonChatChoice;
          llmResult = choice.text as any;
        }

        ret = this._parseResultSchema(parseSchema, parseType, llmResult);
        valid = !validate || validate(ret, i);
      } catch (e) {
        // add error to conversation to optimize result
        errorMessage = e.message;
        this.logger.warn(
          '[retry %s %d/%d] Fail validating generated content: %s',
          template,
          i + 1,
          maxRetry,
          errorMessage,
        );
        continue; // default retry
      }
      break; // force stop;
    }
    if (!valid)
      throw new Error(
        'Fail validating generated content, ' +
          [llmModel, template, errorMessage],
      );

    if (notCached) await this._llmCache(template, llmModel, prompt, llmResult);

    return ret;
  }

  /**
   * multi-turn chat. not cached
   *
   * @param template system prompt template
   * @param messages conversation messages, including current user message
   * @param args { parseSchema: "parsing schema", validate: "validate function to check generated json", parseType }, if parseType is markdown codeBlock, parseSchema must only `new Array(n)`
   * @returns assistant response will be appended to messages
   */
  @Transactional()
  async chat<T>(
    template: string,
    originalMessages: LLMMessage[],
    args: { [key: string]: any },
    {
      bizKey,
      parseType = 'json',
      parseSchema,
      validate,
    }: {
      bizKey?: string;
      parseType?: 'json' | 'codeBlock';
      parseSchema?: T;
      validate?: (generated: T, retry: number) => boolean | void;
    },
  ): Promise<T> {
    const prompt = await this._prompt(template, args);
    // template prompt as system message
    const messages: LLMMessage[] = [
      { role: 'system', content: prompt },
      ...originalMessages,
    ];

    const usrMsg = messages.at(-1);
    if (usrMsg.role !== 'user')
      throw new Error('Current message must be role=user');

    let ret: T;
    let [llmResult, llmModel] = ['', ''];
    let [maxRetry, invalidMsg] = [3, ''];
    for (let i = 0; i < maxRetry; i++) {
      try {
        if (!ret) {
          const req: LLMRequest = {
            messages,
            stream: false,
            route: 'fallback',
            temperature: 0, // TODO
          };
          if (Array.isArray(this.llmModels)) req.models = this.llmModels;
          else req.model = this.llmModels;
          const resp = await this._completion(req);
          llmModel = resp.model;

          if (!resp?.choices?.length) {
            invalidMsg = `LLM service not available, error=${(resp as any)?.error?.message}`;
            break;
          }

          const choice = resp.choices[0] as NonStreamingChoice;
          llmResult = choice.message.content as any;
        }

        ret = this._parseResultSchema(parseSchema, parseType, llmResult);
        if (validate && !validate(ret, i))
          invalidMsg = 'Failed validating generated content';
      } catch (e) {
        // add error to conversation to optimize result
        messages.push({ role: 'assistant', content: llmResult });
        messages.push({
          role: 'user',
          content: `There was a mistake:\n${e.message}\n\nplease re-generate`,
        });
        this.logger.warn(
          '[retry %s %d/%d] Fail validating generated content: %s',
          template,
          i + 1,
          maxRetry,
          e.message,
        );
        ret = undefined;
        continue; // default retry
      }
      break; // force stop;
    }
    if (invalidMsg)
      throw new Error(
        'Fail validating generated content, ' +
          [llmModel, template, invalidMsg],
      );

    originalMessages.push({ role: 'assistant', content: llmResult });
    return ret;
  }
  private _parseResultSchema<T extends {}>(
    parseSchema: T,
    parseType: string,
    llmResult: string,
  ): T {
    if (!parseSchema) return llmResult as any;
    if (!llmResult) throw new Error('LLM result must not empty');

    let ret: T;
    const isArray = Array.isArray(parseSchema);
    switch (parseType) {
      case 'json':
        ret = Utils.toJSON(llmResult, isArray);
        // check type
        this._checkJsonType(parseSchema, ret, isArray);
        break;
      case 'codeBlock':
        const size = (parseSchema as any).length;
        if (!size)
          throw new Error(
            'for parseType="codeBlock", parseSchema must be array',
          );
        const split = llmResult.split(/^\s*```[\w\s]*$/m);
        if (split.length < 2 * size + 1)
          throw new Error(
            size + ' code blocks expected, got: ' + ~~split.length / 2,
          );
        // pick from the end
        const a = Array(size);
        for (let i = -1; i >= -size; i--)
          a[size + i] = split[split.length + i * 2].trim();
        ret = a as any;
        break;
      default:
        throw new Error('Unknown llm result parseType:' + parseType);
    }
    return ret;
  }

  protected _checkJsonType(parseSchema: any, val: any, isArray: boolean) {
    const entries = Object.entries(isArray ? parseSchema[0] : parseSchema);
    const a = isArray ? val : [val];
    for (const v of a) {
      entries.forEach(([key, type]) => {
        if (!type) return; // any type
        // key may be '': means { [key]:.. }
        if (key && !(key in v)) throw new Error(`Json key=${key} is missing`);
        const value = key ? v[key] : Object.values(v)[0];
        if (
          value &&
          (typeof value !== typeof type ||
            Array.isArray(type) != Array.isArray(value))
        )
          throw new Error(
            `Value type of json key=${key} should match example value: ${JSON.stringify(type)}, got: ${JSON.stringify(value)}}`,
          );
      });
    }
  }

  protected async _llmCacheLoad(name: string, prompt: string) {
    let result: string, llmModel: string;
    if (prompt.length <= this.CACHE_PROMPT_MAX_LEN) {
      for (llmModel of this.llmModels) {
        result = (await this._llmCache(name, llmModel, prompt))?.result;
        if (result) break;
      }
    }
    return [result, llmModel];
  }

  protected readonly CACHE_PROMPT_MAX_LEN = 8190;
  protected async _llmCache(
    name: string,
    model: string,
    prompt: string,
    result?: string,
  ) {
    if (prompt.length > this.CACHE_PROMPT_MAX_LEN) {
      this.logger.warn(
        '>>> Prompt too long to cache: name: %s, prompt: \n%s\n\n\tresult: %s',
        name,
        prompt,
        result,
      );
      return;
    }
    const prisma = this.txHost.tx as PrismaClient;
    const ret = await prisma.llmCache.findFirst({
      where: { prompt, model, name },
      select: { pk: true, result: true },
    });

    if (!result) {
      ret && this.logger.debug('>>> Hit LLM result cache: %s, %s', name, model);
      return ret;
    }

    this.logger.debug(
      '>>>> Write LLM result to cache: name: %s, prompt: %s\n\n\tresult: %s',
      name,
      prompt,
      result,
    );
    return ret
      ? prisma.llmCache.update({
          where: { pk: ret.pk },
          data: { result },
        })
      : prisma.llmCache.create({ data: { name, model, prompt, result } });
  }

  protected async _prompt(template: string, args: { [key: string]: any }) {
    let tpl = this.templates[template];
    if (!tpl) {
      const prisma = this.txHost.tx as PrismaClient;
      const tplStr = await prisma.llmTemplate.findUnique({
        where: { name: template },
        select: { prompt: true },
      });
      if (!tplStr?.prompt)
        throw new Error(`LLM Template ${template} not found`);

      this.templates[template] = tpl = dot.template(tplStr.prompt);
    }
    try {
      return tpl(args);
    } catch (e) {
      throw new Error(e);
    }
  }

  protected async _completion(req: LLMRequest): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const url = req.messages
        ? this.configService.get('LLM_CHAT_URL')
        : this.configService.get('LLM_COMPLETION_URL');
      fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.configService.get('LLM_API_KEY')}`,
          'HTTP-Referer': `${this.configService.get('CALLGENT_SITE_URL')}`,
          'X-Title': `${this.configService.get('CALLGENT_SITE_NAME')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
      })
        .then((res) => res.json())
        .then((data: LLMResponse) => {
          data.usage || (data.usage = {} as any);
          data.usage['duration'] = Date.now() - startTime;
          this.logger.debug(
            '>>> LLM %s response usage: %j',
            data.model,
            data.usage,
          );
          this.eventEmitter.emit(
            LlmCompletionEvent.eventName,
            new LlmCompletionEvent(data),
          );
          resolve(data);
        })
        .catch(reject);
    });
  }
}

// Definitions of subtypes are below
type LLMRequest = {
  // Either "messages" or "prompt" is required
  messages?: LLMMessage[];
  prompt?: string;

  // If "model" is unspecified, uses the user's default
  model?: string; // See "Supported Models" section

  // Allows to force the model to produce specific output format.
  // Only supported by OpenAI models, Nitro models, and some others - check the
  // providers on the model page on openrouter.ai/models to see if it's supported,
  // and set `require_parameters` to true in your Provider Preferences. See
  // openrouter.ai/docs#provider-routing
  response_format?: { type: 'json_object' };

  stop?: string | string[];
  stream?: boolean; // Enable streaming

  // See LLM Parameters (openrouter.ai/docs#parameters)
  max_tokens?: number; // Range: [1, context_length)
  temperature?: number; // Range: [0, 2]
  top_p?: number; // Range: (0, 1]
  top_k?: number; // Range: [1, Infinity) Not available for OpenAI models
  frequency_penalty?: number; // Range: [-2, 2]
  presence_penalty?: number; // Range: [-2, 2]
  repetition_penalty?: number; // Range: (0, 2]
  seed?: number; // OpenAI only

  // Function-calling
  // Only natively suported by OpenAI models. For others, we submit
  // a YAML-formatted string with these tools at the end of the prompt.
  tools?: Tool[];
  tool_choice?: ToolChoice;

  // Additional optional parameters
  logit_bias?: { [key: number]: number };

  // OpenRouter-only parameters
  // See "Prompt Transforms" section: openrouter.ai/docs#transforms
  transforms?: string[];
  // See "Model Routing" section: openrouter.ai/docs#model-routing
  models?: string[];
  route?: 'fallback';
  // See "Provider Routing" section: openrouter.ai/docs#provider-routing
  provider?: ProviderPreferences;
};

// Definitions of subtypes are below

export type LLMResponse = {
  id: string;
  // Depending on whether you set "stream" to "true" and
  // whether you passed in "messages" or a "prompt", you
  // will get a different output shape
  choices: (NonStreamingChoice | StreamingChoice | NonChatChoice | Error)[];
  created: number; // Unix timestamp
  model: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  // For non-streaming responses only. For streaming responses,
  // see "Querying Cost and Stats" below.
  usage?: {
    completion_tokens: number; // Equivalent to "native_tokens_completion" in the /generation API
    prompt_tokens: number; // Equivalent to "native_tokens_prompt"
    total_tokens: number; // Sum of the above two fields
    total_cost: number; // Number of credits used by this generation
    prompt_cache_hit_tokens?: number; // Number of tokens served from cache for the prompt
    prompt_cache_miss_tokens?: number; // Number of tokens that missed the cache and were processed normally
  };
};

// Subtypes:

type NonChatChoice = {
  finish_reason: string | null;
  text: string;
};

type NonStreamingChoice = {
  finish_reason: string | null; // Depends on the model. Ex: 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'function_call'
  message: {
    content: string | null;
    role: string;
    tool_calls?: ToolCall[];
    // Deprecated, replaced by tool_calls
    function_call?: FunctionCall;
  };
};

type StreamingChoice = {
  finish_reason: string | null;
  delta: {
    content: string | null;
    role?: string;
    tool_calls?: ToolCall[];
    // Deprecated, replaced by tool_calls
    function_call?: FunctionCall;
  };
};

type Error = {
  code: number; // See "Error Handling" section
  message: string;
};

type FunctionCall = {
  name: string;
  arguments: string; // JSON format arguments
};

type ToolCall = {
  id: string;
  type: 'function';
  function: FunctionCall;
};

// Subtypes:

type TextContent = {
  type: 'text';
  text: string;
};

type ImageContentPart = {
  type: 'image_url';
  image_url: {
    url: string; // URL or base64 encoded image data
    detail?: string; // Optional, defaults to 'auto'
  };
};

type ContentPart = TextContent | ImageContentPart;

export type LLMMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  // ContentParts are only for the 'user' role:
  content: string | ContentPart[];
  // If "name" is included, it will be prepended like this
  // for non-OpenAI models: `{name}: {content}`
  name?: string;
};

type FunctionDescription = {
  description?: string;
  name: string;
  parameters: object; // JSON Schema object
};

type Tool = {
  type: 'function';
  function: FunctionDescription;
};

type ToolChoice =
  | 'none'
  | 'auto'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

class ProviderPreferences {
  allow_fallbacks = true;
  require_parameters?: boolean;
  data_collection?: 'allow' | 'deny' = 'allow';
  order?: (
    | 'OpenAI'
    | 'Anthropic'
    | 'HuggingFace'
    | 'Google'
    | 'Mancer'
    | 'Mancer 2'
    | 'Together'
    | 'DeepInfra'
    | 'Azure'
    | 'Modal'
    | 'AnyScale'
    | 'Replicate'
    | 'Perplexity'
    | 'Recursal'
    | 'Fireworks'
    | 'Mistral'
    | 'Groq'
    | 'Cohere'
    | 'Lepton'
    | 'OctoAI'
    | 'Novita'
  )[];
}
