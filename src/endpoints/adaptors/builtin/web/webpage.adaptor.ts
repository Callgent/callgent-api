import { EndpointDto } from '../../../dto/endpoint.dto';
import { EndpointAdaptorName } from '../../endpoint-adaptor.decorator';
import {
  AdaptedDataSource,
  ApiSpec,
  EndpointAdaptor,
  EndpointConfig,
} from '../../endpoint-adaptor.interface';

@EndpointAdaptorName('webpage', 'both')
export class WebpageAdaptor implements EndpointAdaptor {
  getCallback(callback: string, rawReq: object, reqEndpoint?: EndpointDto): Promise<string> {
    throw new Error('Method not implemented.');
  }
  toJson(rawData: object, request: boolean, endpoint: EndpointDto): AdaptedDataSource {
    throw new Error('Method not implemented.');
  }
  getConfig(): EndpointConfig {
    return {
      host: { address: { type: 'url', name: 'Page URL' } },
      server: {
        addParams: true,
        params: [
          {
            type: 'readonly',
            name: 'Note',
            position: 'top',
            value:
              '> This is for simple web page operations. For complex pages such as SPA, you may need other tools, e.g. RPAs, [SeeAct](https://github.com/OSU-NLP-Group/SeeAct), etc.',
          },
          {
            type: 'readonly',
            name: 'Download Chrome Plugin',
            position: 'bottom',
            value:
              'Before continue, please confirm this automation does NOT violate any ToS or regulations of the target website!  \nYour need to install the [Botlet Web Page](https://chrome.google.com/webstore/detail/botlet-web-page/pefjgjgjgjgjgjgjgjgjgjgjgjgjgjgj) Chrome plugin, as the operation client.  \n> Note: You need to keep the Chrome open to perform tasks.',
          },
        ],
      },
      client: {
        host: {
          address: {
            type: 'domain',
            name: 'Custom Domain',
            value: 'page.botlet.io',
            placeholder: 'Not applicable in Free plan.',
          },
        },
        params: [
          { type: 'radio', name: 'Page Type', value: ['WEB', 'React', 'Vue'] },
        ],
        addParams: true,
        initParams: [
          {
            name: 'Page Generation Prompt',
            type: 'textarea',
            placeholder: 'Prompt or content to generate the Web Page.',
          },
        ],
      },
    };
  }

  /** generate a web page endpoint */
  initClient(params: object, endpoint: EndpointDto): Promise<string> {
    throw new Error('Method not implemented.');
  }

  /** generate operation script based on the Chrome plugin */
  initServer(initParams: object, endpoint: EndpointDto): Promise<string> {
    // - scrape the web page
    const url = endpoint.host['Page URL'];
    // - script to operate the page
    // auth handler
    throw new Error('Method not implemented.');
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
