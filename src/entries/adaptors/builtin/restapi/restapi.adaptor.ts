import {
  BadRequestException,
  Inject,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';
import { AgentsService } from '../../../../agents/agents.service';
import { EndpointDto } from '../../../../endpoints/dto/endpoint.dto';
import { ServiceResponse } from '../../../../event-listeners/event-object';
import { EntryDto } from '../../../dto/entry.dto';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { BothEntryAdaptor } from '../../entry-adaptor.base';
import { EntryAdaptor } from '../../entry-adaptor.decorator';
import { ParameterObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

@EntryAdaptor('restAPI', { both: '/icons/RestAPI.svg' })
export class RestAPIAdaptor extends BothEntryAdaptor {
  constructor(@Inject('AgentsService') readonly agentsService: AgentsService) {
    super(agentsService);
  }

  isAsync = () => false;

  _genClientHost(data: Prisma.EntryUncheckedCreateInput) {
    // unstructured request url
    data.host = `/api/rest/request/${data.callgentId}/${data.id}`;
  }

  /** generate a web page entry */
  initClient(params: object, entry: EntryDto): Promise<string> {
    throw new NotImplementedException('Method not implemented.');
  }

  /** generate operation script based on the Chrome plugin */
  initServer(initParams: object, entry: EntryDto): Promise<string> {
    // - scrape the web page
    const url = entry.host['Page URL'];
    // - script to fill params into the page
    // const reqTemplate = entry.reqParamTemplate;
    // - script to operate the page
    // auth handler
    throw new NotImplementedException('Method not implemented.');
  }

  async preprocess(
    reqEvent: ClientRequestEvent,
    // entry: EntryDto,
  ) {
    const req = reqEvent?.context.req;
    if (!req)
      throw new BadRequestException(
        'Missing request object for ClientRequestEvent#' + reqEvent.id,
      );
    const {
      callback,
      context: { progressive },
    } = reqEvent;

    // read callback from cep config
    if (!callback) {
    }
    // read progressive from cep config
    if (!progressive) {
    }

    reqEvent.context.req = this.req2Json(req);
  }

  protected async _invoke(
    sep: EndpointDto,
    args: { [name: string]: any },
    sen: EntryDto,
    reqEvent: ClientRequestEvent,
  ) {
    const { parameters, requestBody } = sep.params as any;
    const { query, header, path, cookie } = this._extractParameters(
      parameters,
      args,
    );
    const url = this._resolveUrl(path, query, sep.path);

    const headers = reqEvent.context.req.headers;
    const { key, value: oldCookies } = this._getCookie(headers);
    if (key) delete headers[key];
    if (Object.keys(cookie).length > 0) {
      header['Cookie'] = this._formatCookies(cookie);
      if (oldCookies) header['Cookie'] = oldCookies + '; ' + header['Cookie'];
    } else header['Cookie'] = oldCookies;

    let data;
    try {
      const resp = await axios.request({
        headers: {
          ...headers,
          ...header,
          host: undefined,
          'content-length': undefined,
        },
        url,
        method: sep.method,
        data: requestBody,
        baseURL: sen.host,
        withCredentials: !!reqEvent.context.securityItem,
        // httpsAgent: new https.Agent({
        //   rejectUnauthorized: false,
        // }),
      });
      data = this.resp2json(resp);
    } catch (e) {
      // server error is also a resp
      data = (e.response && this.resp2json(e.response)) || {
        status: e.status || 500,
        statusText: e.statusText || 'Internal Server Error',
        message: e.message,
      };
    }
    return { data };
  }
  private _resolveUrl(
    path: { [key: string]: any },
    query: { [key: string]: any },
    urlTemplate: string,
  ) {
    let resolvedUrl = urlTemplate;
    Object.keys(path).forEach((key) => {
      const regex = new RegExp(`:${key}(\\/|$)`, 'g');
      resolvedUrl = resolvedUrl.replace(regex, `${path[key]}$1`);
    });
    const queryString = Object.keys(query)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
      )
      .join('&');
    return queryString ? `${resolvedUrl}?${queryString}` : resolvedUrl;
  }

  private _getCookie(headers: any) {
    if (!headers) return;
    const keys = Object.keys(headers);
    for (let key of keys) {
      key = key.toLowerCase();
      if (key === 'cookie') return { key, value: headers[key] };
    }
    return {};
  }

  private _formatCookies(cookie: { [key: string]: any }): string {
    return Object.keys(cookie)
      .map(
        (key) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(cookie[key])}`,
      )
      .join('; ');
  }

  private _extractParameters(
    params: ParameterObject[],
    args: { [name: string]: any },
  ) {
    const query: { [key: string]: any } = {};
    const header: { [key: string]: any } = {};
    const path: { [key: string]: any } = {};
    const cookie: { [key: string]: any } = {};

    params?.forEach((param) => {
      if (args[param.name] !== undefined) {
        switch (param.in) {
          case 'query':
            query[param.name] = args[param.name];
            break;
          case 'header':
            header[param.name] = args[param.name];
            break;
          case 'path':
            path[param.name] = args[param.name];
            break;
          case 'cookie':
            cookie[param.name] = args[param.name];
            break;
          default:
            break;
        }
      }
    });

    return { query, header, path, cookie };
  }

  async postprocess(resp: any): Promise<ServiceResponse> {
    return resp;
  }

  async getCallback(callback: string, reqEntry?: EntryDto) {
    // FIXME
    return callback;
  }

  req2Json(request) {
    if (!request?.method) return request;

    // handle http request
    const { method, headers, query, body, url: url0 } = request;
    if (url0.indexOf('/rest/invoke/') < 0)
      throw new Error(
        'Unsupported URL, should be /rest/invoke/:callgentId/:entry/*',
      );
    let idx = url0.indexOf('/rest/invoke/');
    idx = url0.indexOf('/', idx + 13);
    idx = url0.indexOf('/', idx + 1);
    const url = url0.substr(idx);

    // const type = request.isFormSubmission ? 'form' : 'body';

    // FIXME change authorization to x-callgent-authorization
    return {
      url,
      method,
      headers,
      params: query, // axios
      // files,
      data: body, // TODO axios FormData, URLSearchParams, Blob..
    };
  }

  resp2json(resp: AxiosResponse) {
    const { data, headers: rawHeaders, status, statusText } = resp;
    const headers = {};
    Object.entries(rawHeaders).forEach(
      ([name, val]) =>
        name.toLowerCase() == 'content-length' ||
        (headers[name.toLowerCase()] = val),
    );
    return { data, headers, status, statusText };
  }

  callback(resp: any): Promise<boolean> {
    throw new NotImplementedException('Method not implemented.');
  }

  // getConfig(): EntryConfig {
  //   return {
  //     server: {
  //       host: {
  //         address: {
  //           type: 'url',
  //           name: 'API root URL',
  //         },
  //         authConfig: [
  //           {
  //             name: 'tokenName',
  //             label: 'Token Name',
  //             type: 'text',
  //           },
  //           {
  //             name: 'tokenPosition',
  //             label: 'Where is the Token',
  //             type: 'select',
  //             value: ['header', 'cookie', 'body', 'query'],
  //           },
  //           {
  //             name: 'credentialsType',
  //             label: 'Credentials Type',
  //             placeholder:
  //               'Method to exchange token from credentials: token = exchange(credentials, args)',
  //             type: 'select',
  //             value: {
  //               constant: [
  //                 { name: 'apiKey', label: 'API Key', type: 'password' },
  //               ],
  //               oauth: [],
  //               function: [],
  //             },
  //           },
  //         ],
  //       },
  //       addParams: true,
  //       params: [
  //         {
  //           type: 'readonly',
  //           name: 'Note',
  //           position: 'top',
  //           value:
  //             '> This is for simple web page operations. For complex pages such as SPA, you may need other tools, e.g. RPAs, [SeeAct](https://github.com/OSU-NLP-Group/SeeAct), etc.',
  //         },
  //         {
  //           type: 'readonly',
  //           name: 'Download Chrome Plugin',
  //           position: 'bottom',
  //           value:
  //             'Before continue, please confirm this automation does NOT violate any ToS or regulations of the target website!  \nYour need to install the [Callgent Web Page](https://chrome.google.com/webstore/detail/callgent-web-page/pefjgjgjgjgjgjgjgjgjgjgjgjgjgjgj) Chrome plugin, as the operation client.  \n> Note: You need to keep the Chrome open to perform tasks.',
  //         },
  //       ],
  //     },
  //     client: {
  //       host: {
  //         address: {
  //           type: 'domain',
  //           name: 'Custom Domain',
  //           value: 'page.callgent.com',
  //           placeholder: 'Not applicable in Free plan.',
  //         },
  //       },
  //       params: [
  //         {
  //           type: 'url',
  //           name: 'Callback URL',
  //           optional: true,
  //           placeholder:
  //             'Callback URL to receive response with request ID. TODO: api spec',
  //         },
  //         { type: 'radio', name: 'Page Type', value: ['WEB', 'React', 'Vue'] },
  //       ],
  //       addParams: true,
  //       initParams: [
  //         {
  //           name: 'Page Generation Prompt',
  //           type: 'textarea',
  //           placeholder: 'Prompt or content to generate the Web Page.',
  //         },
  //       ],
  //     },
  //   };
  // }
}
