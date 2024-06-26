import $RefParser from '@apidevtools/json-schema-ref-parser';
import { BadRequestException, Inject } from '@nestjs/common';
import { AgentsService } from '../../../../agents/agents.service';
import { EndpointDto } from '../../../dto/endpoint.dto';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { EndpointAdaptorName } from '../../endpoint-adaptor.decorator';
import {
  ApiSpec,
  EndpointAdaptor,
  EndpointConfig,
} from '../../endpoint-adaptor.interface';

class RequestJson {
  url: string;
  method: string;
  headers?: { [key: string]: string };
  query?: { [key: string]: string };
  params?: { [key: string]: string };
  files?: { [key: string]: any };
  body?: any;
  form?: any;
}

class ResponseJson {
  data: any;
  dataType: string;
  headers?: { [key: string]: string };
  status?: number;
  statusText?: string;
}

@EndpointAdaptorName('restAPI', 'both')
export class RestAPIAdaptor implements EndpointAdaptor {
  constructor(
    @Inject('AgentsService') private readonly agentsService: AgentsService,
  ) {}

  getConfig(): EndpointConfig {
    return {
      server: {
        host: {
          address: {
            type: 'url',
            name: 'API root URL',
          },
          authConfig: [
            {
              name: 'tokenName',
              label: 'Token Name',
              type: 'text',
            },
            {
              name: 'tokenPosition',
              label: 'Where is the Token',
              type: 'select',
              value: ['header', 'cookie', 'body', 'query'],
            },
            {
              name: 'credentialsType',
              label: 'Credentials Type',
              placeholder:
                'Method to exchange token from credentials: token = exchange(credentials, args)',
              type: 'select',
              value: {
                constant: [
                  { name: 'apiKey', label: 'API Key', type: 'password' },
                ],
                oauth: [],
                function: [],
              },
            },
          ],
        },
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
              'Before continue, please confirm this automation does NOT violate any ToS or regulations of the target website!  \nYour need to install the [Callgent Web Page](https://chrome.google.com/webstore/detail/callgent-web-page/pefjgjgjgjgjgjgjgjgjgjgjgjgjgjgj) Chrome plugin, as the operation client.  \n> Note: You need to keep the Chrome open to perform tasks.',
          },
        ],
      },
      client: {
        host: {
          address: {
            type: 'domain',
            name: 'Custom Domain',
            value: 'page.callgent.com',
            placeholder: 'Not applicable in Free plan.',
          },
        },
        params: [
          {
            type: 'url',
            name: 'Callback URL',
            optional: true,
            placeholder:
              'Callback URL to receive response with request ID. TODO: api spec',
          },
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
    // - script to fill params into the page
    // const reqTemplate = endpoint.reqParamTemplate;
    // - script to operate the page
    // auth handler
    throw new Error('Method not implemented.');
  }

  async preprocess(
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<void | { event: ClientRequestEvent; callbackName?: string }> {
    if (!reqEvent.rawReq)
      throw new BadRequestException(
        'Missing request object for ClientRequestEvent',
      );
    const {
      callback,
      data: { progressive },
    } = reqEvent;

    // read callback from cep config
    if (!callback) {
    }
    // read progressive from cep config
    if (!progressive) {
    }

    reqEvent.data.req = this.req2Json(reqEvent.rawReq);
  }

  async parseApis(apiTxt: { text: string; format?: string }) {
    const ret: ApiSpec = { apis: [] };

    const { text, format } = apiTxt;
    if (!format || format === 'openAPI') {
      let json = JSON.parse(text);
      try {
        json = await $RefParser.dereference(json);
      } catch (err) {
        throw new BadRequestException(err);
      }
      const { paths } = json;

      if (paths) {
        const ps = Object.entries(paths);
        for (const [path, pathApis] of ps) {
          const entries = Object.entries(pathApis);
          for (const [method, restApi] of entries) {
            // wrap schema

            const apiName = RestAPIAdaptor.formalActionName(method, path);
            const func = await this.agentsService.api2Function(
              'restAPI',
              '(req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>',
              {
                apiName,
                apiContent: JSON.stringify(restApi),
              },
            );
            ret.apis.push({
              name: apiName,
              ...func,
              content: restApi,
            });
          }
        }
      }

      return ret;
    }

    throw new BadRequestException('Unsupported format: ' + format);
  }

  // async invoke() {}

  async getCallback(
    callback: string,
    rawReq: object,
    reqEndpoint?: EndpointDto,
  ) {
    // FIXME
    return callback;
  }

  req2Json(request) {
    const { method, headers: rawHeaders, query, body, raw } = request;
    if (request.url.indexOf('/invoke/api/') < 0)
      throw new Error(
        'Unsupported URL, should be /callgents/:uuids/:endpoint/invoke/api/*',
      );
    const url = request.url.substr(request.url.indexOf('/invoke/api/') + 11);

    let files: Record<string, any> = {};
    if (request.file) {
      files[request.file.fieldname] = request.file;
    } else if (raw.files) {
      for (const [key, value] of Object.entries(raw.files)) {
        files[key] = value;
      }
    } else files = undefined;

    const type = request.isFormSubmission ? 'form' : 'body';

    // filter all x-callgent- args
    const headers = { ...rawHeaders };
    Object.keys(headers).forEach((key) => {
      if (key.startsWith('x-callgent-')) delete headers[key];
    });

    // FIXME change authorization to x-callgent-authorization
    return {
      url,
      method,
      headers: { ...headers }, // filter callgent authorization
      query,
      files,
      [type]: body,
    };
  }

  async readData(name: string, hints?: { [key: string]: any }) {
    throw new Error('Method not implemented.');
  }

  async invoke(req: RequestJson): Promise<ResponseJson> {
    //
    throw new Error('Method not implemented.');
  }

  callback(resp: any): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  static formalActionName = (method, path) =>
    `${(method || 'GET').toUpperCase()}:${path}`;
}
