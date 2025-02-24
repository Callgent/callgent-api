import { Transactional } from '@nestjs-cls/transactional';
import {
  BadRequestException,
  Inject,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as httpStatus from 'http-status';
import { AgentsService } from '../../../../agents/agents.service';
import { RelayEmail } from '../../../../emails/dto/sparkpost-relay-object.interface';
import {
  EmailRelayKey,
  EmailsService,
} from '../../../../emails/emails.service';
import { EndpointDto } from '../../../../endpoints/dto/endpoint.dto';
import { EntryDto } from '../../../dto/entry.dto';
import { Entry } from '../../../entities/entry.entity';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../../events/client-request.event';
import { BothEntryAdaptor, PendingOrResponse } from '../../entry-adaptor.base';
import { EntryAdaptorDecorator } from '../../entry-adaptor.decorator';

@EntryAdaptorDecorator('Email', { both: '/icons/Email.svg' })
export class EmailAdaptor extends BothEntryAdaptor {
  constructor(
    @Inject('AgentsService') readonly agentsService: AgentsService,
    private readonly emailsService: EmailsService,
  ) {
    super(agentsService);
  }

  isAsync = () => true;

  _genClientHost(data: Prisma.EntryUncheckedCreateInput) {
    data.host = this.emailsService.getRelayAddress(
      data.callgentId,
      EmailRelayKey.callgent,
    );
  }

  getCallback(callback: string, reqEntry?: EntryDto): Promise<string> {
    throw new NotImplementedException('Method not implemented.');
  }

  // getConfig(): EntryConfig {
  //   return {};
  // }

  /** generate a web page entry */
  async initClient(params: object, entry: Entry) {
    return '';
  }

  /** generate operation script based on the Chrome plugin */
  async initServer(initParams: object, entry: EntryDto) {
    // throw new NotImplementedException('Method not implemented.');
    return '';
  }

  async preprocess(reqEvent: ClientRequestEvent, entry: EntryDto) {
    //
  }

  @Transactional()
  async postprocess(
    resp: RelayEmail,
    reqEvent: ClientRequestEvent,
    fun: EndpointDto,
    ctx: InvokeStatus,
  ) {
    if (!resp?.content?.html)
      throw new BadRequestException(
        'Missing response for reqEvent#' + reqEvent.id,
      );

    // convert resp to api format
    const data = await this.agentsService.convert2Response(
      ctx.args,
      resp.content.text || resp.content.html,
      fun,
      reqEvent,
    );
    return data;
  }

  callback(resp: any): Promise<boolean> {
    throw new NotImplementedException('Method not implemented.');
  }

  /**
   * constructs an email sent to sep.host
   *
   * @param endpoint - function
   * @param args - function arguments
   * @param sentry - config
   * @param reqEvent - context event
   */
  async invoke(
    endpoint: EndpointDto,
    args: object,
    sentry: Entry,
    reqEvent: ClientRequestEvent,
    ctx: InvokeStatus,
  ) {
    const emailFrom = this.emailsService.getRelayAddress(
      reqEvent.id,
      EmailRelayKey.request,
    );
    const { host: emailTo } = sentry;

    const params = this._params30x(endpoint.params, args);
    const responses = this._responses30x(endpoint.responses);
    return this.emailsService
      .sendTemplateEmail(
        emailTo,
        'relay-sep-invoke',
        {
          relayId: `${ctx.invokeId}-${reqEvent.id}`, // todo
          callgentName: reqEvent.context.callgentName,
          endpoint,
          params,
          responses,
        },
        { email: emailFrom, name: 'Callgent Invoker' },
      )
      .then((res): PendingOrResponse => {
        return res
          ? {
              statusCode: 2,
              message: 'Service called via email, please wait for reply.',
            }
          : {
              data: {
                status: 500,
                statusText: 'Failed to call service via email ' + emailTo,
              },
            };
      });
  }

  /** openAPI 3.0.x */
  protected _params30x(params: any, args: object) {
    const ret = [];
    const { parameters, requestBody } = params;
    parameters?.forEach((p) => {
      ret.push({ ...p, value: args[p.name] });
    });
    if (requestBody) {
      const item: any = { name: 'requestBody' };
      // item.content = this._formatMediaType(requestBody.content);
      item.value = args['requestBody'];
      if (requestBody.required) item.required = requestBody.required;
      if (requestBody.description) item.description = requestBody.description;
      ret.push(item);
    }
    return ret;
  }

  /** openAPI 3.0.x */
  protected _responses30x(responses: any) {
    const list = [];
    if (!responses) return list;
    if (responses.default)
      list.push({ ...responses.default, name: 'Default Response' });
    Object.keys(responses).forEach((k) => {
      if (k == 'default') return;
      // FIXME format headers, links, also change 'relay-sep-invoke.dot'
      const { headers, links, content, description } = responses[k];
      list.push({
        name: httpStatus[k] || k,
        description,
        content: this._formatMediaType(content),
      }); // TODO format
    });
    return list;
  }

  protected _formatMediaType(content: any) {
    const list = [];
    if (!content) return content;

    Object.values(content).forEach((c: any) => {
      if (c.schema) {
        list.push(this._formatSchema(c.schema));
      } else if (c.examples) {
        // TODO examples
        list.push(...c.examples);
      } else if (c.example) list.push(c.example);
    });

    return list.length == 1 ? list[0] : list;
  }
  private _formatSchema(schema: any) {
    if (schema.type == 'array') {
      return [this._formatSchema(schema.items)];
    } else if (schema.type == 'object') {
      const props = {};
      Object.entries(schema.properties).forEach((entry: [string, any]) => {
        const [k, v] = entry;
        props[k + `${v.required ? '*' : ''}`] = this._formatSchema({
          ...v,
          required: undefined,
        });
      });
      return props;
    } else if (schema.type == 'string') {
      let pre = schema.format ? `format: ${schema.format}, ` : '';
      pre += schema.pattern ? `pattern: ${schema.pattern}, ` : '';
      pre += schema.enum ? `enums: ${JSON.stringify(schema.enum)}, ` : '';
      return pre + (schema.description || 'string');
    } else return schema; // TODO: similar to string
  }
}
