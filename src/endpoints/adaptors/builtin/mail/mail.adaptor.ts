import { EndpointDto } from '../../../dto/endpoint.dto';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { EndpointAdaptorName } from '../../endpoint-adaptor.decorator';
import {
  ApiSpec,
  EndpointAdaptor,
  EndpointConfig
} from '../../endpoint-adaptor.interface';

@EndpointAdaptorName('mail', 'both')
export class MailAdaptor implements EndpointAdaptor {
  getCallback(
    callback: string,
    rawReq: object,
    reqEndpoint?: EndpointDto,
  ): Promise<string> {
    throw new Error('Method not implemented.');
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
    // throw new Error('Method not implemented.');
    return '';
  }

  async preprocess(reqEvent: ClientRequestEvent, endpoint: EndpointDto) {
    //
  }

  parseApis(apiTxt: { text: string; format?: string }): Promise<ApiSpec> {
    throw new Error('Method not implemented.');
  }
  readData(name: string, hints?: { [key: string]: any }): Promise<any> {
    throw new Error('Method not implemented.');
  }

  req2Json(req: object) {
    throw new Error('Method not implemented.');
  }

  async invoke(params: object) {
    throw new Error('Method not implemented.');
  }

  callback(resp: any): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
