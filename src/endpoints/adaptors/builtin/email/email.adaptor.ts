import { Transactional } from '@nestjs-cls/transactional';
import {
  BadRequestException,
  Inject,
  NotImplementedException,
} from '@nestjs/common';
import * as httpStatus from 'http-status';
import { AgentsService } from '../../../../agents/agents.service';
import { CallgentFunctionDto } from '../../../../callgent-functions/dto/callgent-function.dto';
import { RelayEmail } from '../../../../emails/dto/sparkpost-relay-object.interface';
import {
  EmailRelayKey,
  EmailsService,
} from '../../../../emails/emails.service';
import { EndpointDto } from '../../../dto/endpoint.dto';
import { Endpoint } from '../../../entities/endpoint.entity';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { EndpointAdaptor, EndpointConfig } from '../../endpoint-adaptor.base';
import { EndpointAdaptorName } from '../../endpoint-adaptor.decorator';

@EndpointAdaptorName('Email', 'both')
export class EmailAdaptor extends EndpointAdaptor {
  constructor(
    @Inject('AgentsService') readonly agentsService: AgentsService,
    private readonly emailsService: EmailsService,
  ) {
    super(agentsService);
  }

  getCallback(callback: string, reqEndpoint?: EndpointDto): Promise<string> {
    throw new NotImplementedException('Method not implemented.');
  }

  getConfig(): EndpointConfig {
    return {};
  }

  /** generate a web page endpoint */
  async initClient(params: object, endpoint: EndpointDto) {
    return '';
  }

  /** generate operation script based on the Chrome plugin */
  async initServer(initParams: object, endpoint: EndpointDto) {
    // throw new NotImplementedException('Method not implemented.');
    return '';
  }

  async preprocess(reqEvent: ClientRequestEvent, endpoint: EndpointDto) {
    //
  }

  @Transactional()
  async postprocess(reqEvent: ClientRequestEvent, fun: CallgentFunctionDto) {
    const resp = reqEvent?.context?.resp as unknown as RelayEmail;
    if (!resp?.content?.html)
      throw new BadRequestException(
        'Missing response for reqEvent#' + reqEvent.id,
      );

    // convert resp to api format
    reqEvent.context.resp = await this.agentsService.convert2Response(
      reqEvent?.context?.map2Function?.args,
      resp.content.text || resp.content.html,
      fun,
      reqEvent.id,
    );
  }

  readData(name: string, hints?: { [key: string]: any }): Promise<any> {
    throw new NotImplementedException('Method not implemented.');
  }

  req2Json(req: object) {
    throw new NotImplementedException('Method not implemented.');
  }

  callback(resp: any): Promise<boolean> {
    throw new NotImplementedException('Method not implemented.');
  }

  /**
   * constructs an email sent to sep.host
   *
   * @param fun - callgent function
   * @param args - function arguments
   * @param sep - server endpoint
   * @param reqEvent - client request event
   */
  async invoke(
    fun: CallgentFunctionDto,
    args: object,
    sep: Endpoint,
    reqEvent: ClientRequestEvent,
  ) {
    const emailFrom = this.emailsService.getRelayAddress(
      reqEvent.id,
      EmailRelayKey.request,
    );
    const { host: emailTo } = sep;

    const responses = this._responses30x(fun.responses);
    return this.emailsService
      .sendTemplateEmail(
        emailTo,
        'relay-sep-invoke',
        { relayId: reqEvent.id, fun, sep, args, responses },
        { email: emailFrom, name: 'Callgent Invoker' },
      )
      .then((res) => ({
        statusCode: res ? 2 : 500, // pending or error
        data: reqEvent,
        resumeFunName: 'postInvokeSEP',
        message: res
          ? 'Service called via email, please wait for async response'
          : 'Failed to call service via email',
      }));
  }

  private _responses30x(responses: any) {
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

  private _formatMediaType(content: any) {
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
