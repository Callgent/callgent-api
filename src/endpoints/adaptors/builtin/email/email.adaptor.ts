import { Inject, NotImplementedException } from '@nestjs/common';
import { AgentsService } from '../../../../agents/agents.service';
import { CallgentFunctionDto } from '../../../../callgent-functions/dto/callgent-function.dto';
import { EmailsService } from '../../../../emails/emails.service';
import { EndpointDto } from '../../../dto/endpoint.dto';
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
  async invoke(
    fun: CallgentFunctionDto,
    args: object,
    sep: EndpointDto,
    reqEvent: ClientRequestEvent,
  ) {
    const emailFrom = this.emailsService.getRelayAddress(reqEvent.id, 'request');
    const { host: emailTo } = sep;
    const subject = '';
    const body = '';
    return this.emailsService
      .sendEmail(emailTo, subject, body, emailFrom)
      .then((res) => ({
        statusCode: res ? -1 : 500, // processing or error
        event: { ...reqEvent, rawReq: undefined },
        message: res
          ? 'Service called via email, please wait for async response'
          : 'Failed to call service via email',
      }));
  }
}
