import { BadRequestException } from '@nestjs/common';
import { EndpointDto } from '../../../dto/endpoint.dto';
import { EndpointAdaptorName } from '../../endpoint-adaptor.decorator';
import {
  AdaptedDataSource,
  ApiSpec,
  EndpointAdaptor,
  EndpointConfig,
} from '../../endpoint-adaptor.interface';

@EndpointAdaptorName('restAPI', 'both')
export class RestAPIAdaptor implements EndpointAdaptor {
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

  async parseApis(apiTxt: { text: string; format?: string }) {
    const ret: ApiSpec = { actions: [], schemas: [] };

    const { text, format } = apiTxt;
    if (!format || format === 'openAPI') {
      const { paths, components } = JSON.parse(text);
      if (components?.schemas)
        Object.entries(components.schemas).forEach(([name, schema]) => {
          ret.schemas.push({ name, content: schema });
        });

      if (paths) {
        Object.entries(paths).forEach(([path, pathApis]) => {
          Object.entries(pathApis).forEach(([method, methodApis]) => {
            ret.actions.push({
              name: RestAPIAdaptor.formalActionName(method, path),
              content: methodApis,
            });
          });
        });
      }

      return ret;
    }

    throw new BadRequestException('Unsupported format: ' + format);
  }

  async getCallback(
    callback: string,
    rawReq: object,
    reqEndpoint?: EndpointDto,
  ) {
    // FIXME
    return callback;
  }
  toJson(
    rawData: object,
    // request: boolean,
    // endpoint: EndpointDto,
  ): AdaptedDataSource {
    return this.req2Json(rawData);
  }

  req2Json(request) {
    const { url, method, headers, query, params, body, raw } = request;

    let files: Record<string, any> = {};
    if (request.file) {
      files[request.file.fieldname] = request.file;
    } else if (raw.files) {
      for (const [key, value] of Object.entries(raw.files)) {
        files[key] = value;
      }
    } else files = undefined;

    const type = request.isFormSubmission ? 'form' : 'body';

    return {
      url,
      method,
      headers,
      query,
      params,
      files,
      [type]: body,
    };
  }

  async readData(name: string, hints?: { [key: string]: any }) {
    throw new Error('Method not implemented.');
  }

  async invoke(params: object) {
    throw new Error('Method not implemented.');
  }

  callback(resp: any): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  static formalActionName = (method, path) =>
    `${(method || 'GET').toUpperCase()}:${path}`;
}
