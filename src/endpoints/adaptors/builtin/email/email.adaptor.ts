import { Inject, NotImplementedException } from '@nestjs/common';
import { AgentsService } from '../../../../agents/agents.service';
import { CallgentFunctionDto } from '../../../../callgent-functions/dto/callgent-function.dto';
import {
  EmailRelayKey,
  EmailsService,
} from '../../../../emails/emails.service';
import { EventObject } from '../../../../event-listeners/event-object';
import { EndpointDto } from '../../../dto/endpoint.dto';
import { Endpoint } from '../../../entities/endpoint.entity';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { EndpointAdaptor, EndpointConfig } from '../../endpoint-adaptor.base';
import { EndpointAdaptorName } from '../../endpoint-adaptor.decorator';
import * as httpStatus from 'http-status';

@EndpointAdaptorName('Email', 'both')
export class EmailAdaptor extends EndpointAdaptor {
  constructor(
    @Inject('AgentsService') readonly agentsService: AgentsService,
    private readonly emailsService: EmailsService,
  ) {
    super(agentsService);
  }

  getCallback(
    callback: string,
    rawReq: object,
    reqEndpoint?: EndpointDto,
  ): Promise<string> {
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
  async invoke<T extends EventObject>(
    fun: CallgentFunctionDto,
    args: object,
    sep: Endpoint,
    reqEvent: T,
  ) {
    const emailFrom = this.emailsService.getRelayAddress(
      reqEvent.id,
      EmailRelayKey.request,
    );
    const { host: emailTo } = sep;

    args = this._argsList30x(args);
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

  private _argsList30x(args: object): object[] {
    const list = [];
    if (!args) return list;
    const { parameters, requestBody } = args as any;
    parameters?.forEach((p) => list.push(p.value));
    // no name means it's a request body
    requestBody && list.push(requestBody); // TODO format
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
      list.push({ name: httpStatus[k] || k, description, content }); // TODO format
    });
    return list;
  }
}
