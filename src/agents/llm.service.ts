import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import * as dot from 'dot';
import { Utils } from '../infra/libs/utils';
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
    this.llmModels = JSON.parse(this.configService.get('LLM_MODELS'));
  }
  protected llmModels: string[];
  private readonly logger = new Logger(LLMService.name);

  /**
   * @param template prompt template name
   * @param args  prompt args
   * @param returnType if not empty, try to parse the response as the specified json. for index signature, do this: const key=''; returnType = { [key]: any }
   * @param validate if error: stop retry, true/false: retry default times, void: force retry. default retry is 3
   */
  @Transactional()
  async template<T>(
    template: string,
    args: { [key: string]: any },
    {
      returnType,
      bizKey,
      validate,
    }: {
      returnType?: T;
      bizKey?: string;
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
      llmResult = '';
    let [maxRetry, valid] = [3, undefined];
    for (let i = 0; i < maxRetry; i++) {
      try {
        ret = cache as T;
        if (!ret) {
          const resp = await this._completion({
            // messages: [{ role: 'user', content: prompt }],
            prompt,
            stream: false,
            models: this.llmModels,
            route: 'fallback',
            temperature: 0.5,
          });
          llmModel = resp.model;

          if (!resp?.choices?.length) {
            i = maxRetry; // force stop
            throw new Error(
              `LLM service not available: template=${template} bizKey=${bizKey}, error=${(resp as any)?.error?.message}`,
            );
          }

          const choice = resp.choices[0] as NonChatChoice;
          llmResult = ret = choice.text as any;
        }

        if (returnType) {
          const isArray = Array.isArray(returnType);
          ret = Utils.toJSON(ret as any, isArray);
          // check type
          this._checkJsonType(returnType, ret, isArray);
        }
      } catch (e) {
        // TODO: add error to conversation to optimize result
        this.logger.warn(
          '[retry %d/%d] Fail validating generated content: \n-----%s\n\n\t>>>>>%s',
          i + 1,
          maxRetry,
          prompt.replace(/\n/g, '\\n'),
          llmResult.replace(/\n/g, '\\n'),
        );
        continue; // default retry
      }
      try {
        valid = !validate || validate(ret, i);
      } catch (e) {
        this.logger.warn('validate error, force no retry: %s', e.message);
        break; // force stop
      }
      if (typeof valid !== 'boolean') maxRetry = i + 2; // force retry;
      if (valid) break;
      this.logger.warn(
        '[retry %d/%d] Fail validating generated content: \n-----%s\n\n\t>>>>>%s',
        i + 1,
        maxRetry,
        prompt.replace(/\n/g, '\\n'),
        llmResult.replace(/\n/g, '\\n'),
      );
    }
    if (!valid)
      throw new Error(
        'Fail validating generated content, ' + [llmModel, template],
      );

    if (notCached) await this._llmCache(template, llmModel, prompt, llmResult);

    return ret;
  }

  protected _checkJsonType(returnType: any, val: any, isArray: boolean) {
    const entries = Object.entries(isArray ? returnType[0] : returnType);
    const a = isArray ? val : [val];
    for (const v of a) {
      if (
        !entries.every(([key, type]) => {
          // key may be '': means { [key]:.. }
          if (key && !(key in v)) return false;
          const value = key ? v[key] : Object.values(v)[0];
          if (
            value &&
            (typeof value !== typeof type ||
              Array.isArray(type) != Array.isArray(value))
          )
            return false;
          return true;
        })
      )
        throw new Error(
          `Return type error, props=${entries.join(',')}, val=${JSON.stringify(
            val,
          )}`,
        );
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
      fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.configService.get(
            'OPENROUTER_API_KEY',
          )}`,
          'HTTP-Referer': `${this.configService.get('CALLGENT_SITE_URL')}`,
          'X-Title': `${this.configService.get('CALLGENT_SITE_NAME')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
      })
        .then((res) => res.json())
        .then((data) => {
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
  messages?: Message[];
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

type Message = {
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
