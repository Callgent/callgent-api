import {
  BadRequestException,
  Inject,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';
import { AgentsService } from '../../../../agents/agents.service';
import { EndpointDto } from '../../../../endpoints/dto/endpoint.dto';
import { EntryDto } from '../../../dto/entry.dto';
import { ClientRequestEvent } from '../../../events/client-request.event';
import { BothEntryAdaptor } from '../../entry-adaptor.base';
import { EntryAdaptorDecorator } from '../../entry-adaptor.decorator';
import { Utils } from '../../../../infras/libs/utils';

@EntryAdaptorDecorator('restAPI', { both: '/icons/RestAPI.svg' })
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

  async invoke(
    fun: EndpointDto,
    args: object,
    sen: EntryDto,
    reqEvent: ClientRequestEvent,
  ) {
    const resp = await axios.request({
      ...reqEvent.context.req,
      headers: {
        ...reqEvent.context.req.headers,
        host: undefined,
        'content-length': undefined,
      },
      baseURL: sen.host,
      withCredentials: !!reqEvent.context.securityItem,
      // httpsAgent: new https.Agent({
      //   rejectUnauthorized: false,
      // }),
    });
    const data = this.resp2json(resp);
    return { data };
  }

  async postprocess(resp: any) {
    return resp;
  }

  async getCallback(callback: string, reqEntry?: EntryDto) {
    // FIXME
    return callback;
  }

  req2Json(request) {
    if (!request?.method) return request;

    // handle http request
    const { method, headers: rawHeaders, query, body, url: url0 } = request;
    if (url0.indexOf('/rest/invoke/') < 0)
      throw new Error(
        'Unsupported URL, should be /rest/invoke/:callgentId/:entry/*',
      );
    let idx = url0.indexOf('/rest/invoke/');
    idx = url0.indexOf('/', idx + 13);
    idx = url0.indexOf('/', idx + 1);
    const url = url0.substr(idx);

    // const type = request.isFormSubmission ? 'form' : 'body';

    // filter all x-callgent-* args
    const headers = {};
    Object.keys(rawHeaders)
      .sort()
      .forEach((key) => {
        key = key.toLowerCase();
        if (!key.startsWith('x-callgent-')) headers[key] = rawHeaders[key];
      });

    // FIXME change authorization to x-callgent-authorization
    return {
      url,
      method,
      headers: { ...headers }, // filter callgent authorization
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
