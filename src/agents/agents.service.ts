import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { Endpoint } from '../endpoints/entities/endpoint.entity';
import { Entry } from '../entries/entities/entry.entity';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EventListenersService } from '../event-listeners/event-listeners.service';
import { Utils } from '../infras/libs/utils';
import { ProgressiveRequestEvent } from './events/progressive-request.event';
import { LLMMessage, LLMService } from './llm.service';

/** early validation principle[EVP]: validate generated content ASAP.
 * TODO: forward to user to validate macro signature (progressively)? program validate generated schema */
@Injectable()
export class AgentsService {
  constructor(
    private readonly llmService: LLMService,
    private readonly eventListenersService: EventListenersService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  // async api2Function(
  //   format: string,
  //   handle: string,
  //   args: { [key: string]: string },
  // ) {
  //   return this.llmService.template(
  //     'api2Function',
  //     {
  //       format,
  //       handle,
  //       ...args,
  //     },
  //     { epName: '', params: [''], documents: '', fullCode: '' },
  //   );
  // }

  /**
   * choose eps, if epName, directly return
   */
  async chooseEndpoints(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    if (reqEvent.context.epName) return; // needn't choose

    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    if (!endpoints?.length)
      throw new NotFoundException(
        'No endpoints for mapping, ClientRequestEvent#' + reqEvent.id,
      );

    // map from all taskId events
    const messages: LLMMessage[] = [
      ...(reqEvent.histories || []),
      reqEvent,
    ].reduce((pre: LLMMessage[], h) => {
      if (h.statusCode < 0) return pre; // ignore error qas
      pre.push({
        role: 'user',
        content: JSON.stringify(h.context.req),
      });

      // ignore processing/pending
      if (![1, 2].includes(h.statusCode)) {
        const resp = h.context.resp
          ? h.context.resp
          : { statusCode: h.statusCode, message: h.message };
        pre.push({
          role: 'assistant',
          content: JSON.stringify(resp),
        });
      }
      return pre;
    }, []);

    const {
      id,
      srcId,
      dataType: cenAdaptor,
      context: { callgentName, progressive, req },
    } = reqEvent;

    const [epName, argName] = ['', ''];
    const { usedEndpoints, unsureArgs } = await this.llmService.chat(
      'chooseEndpoints',
      messages,
      {
        callgentName,
        endpoints,
        // cenAdaptor,
        // histories,
      },
      {
        bizKey: id,
        resultSchema: {
          usedEndpoints: [{ epName: '', usedFor: '' }],
          unsureArgs: {
            [epName]: {
              [argName]: {
                'extract-from-user-request-or-files': {
                  result: true,
                  explain: '',
                },
                'can-be-retrieved-from-service-calls': {
                  result: true,
                  explain: '',
                },
              },
            },
          },
        },
        // validate endpoints args exists
        validate: (gen) =>
          gen['usedEndpoints'].length &&
          gen['usedEndpoints'].every((ep0) => {
            if (endpoints.find((ep) => ep.name == ep0.epName)) return true;
            throw new Error('Chosen endpoint not exits ' + ep0.epName);
          }) &&
          gen['unsureArgs'] &&
          Object.entries(gen['unsureArgs']).every(([epName, unsureArgs]) => {
            const ep = endpoints.find((ep) => ep.name == epName);
            if (!ep) throw new Error('Chosen endpoint not exits ' + epName);

            const args = unsureArgs ? Object.keys(unsureArgs) : [];
            const { parameters, requestBody } = (ep.params || {}) as any;
            const mediaTypes = requestBody
              ? Object.values(requestBody?.content)
              : [];
            const reqProps = mediaTypes.length
              ? (mediaTypes[0] as any).schema.properties
              : {};

            return args.every((argName) => {
              if (
                parameters?.find((p) => p.name == argName) ||
                this._hasOpenAPIProperty(reqProps, argName)
              )
                return true;
              throw new Error(
                `Arg '${argName}' not found in endpoint '${epName}'`,
              );
            });
          }),
      },
    );

    Object.entries(unsureArgs).forEach(([ep, args]) => {
      Object.entries(args).forEach(([n, arg]) => {
        if (Object.values(arg).some((v) => v?.result)) delete args[n];
      });
      if (!Object.keys(args).length) delete unsureArgs[ep];
    });

    messages.pop(); // remove last assistant message
    const chosen = await this.llmService.chat(
      'askEndpointsArgs',
      messages,
      {
        callgentName,
        endpoints,
        // cenAdaptor,
        unsureArgs,
        usedEndpoints,
      },
      {
        resultSchema: {
          usedEndpoints: [{ epName: '', usedFor: '' }],
          question: '',
        },
        bizKey: id,
        // validate endpoints exists
        validate: (gen) =>
          gen['usedEndpoints'].length &&
          gen['usedEndpoints'].every(({ epName }) => {
            if (!endpoints.find((ep) => ep.name == epName))
              throw new Error('Chosen endpoint not exits ' + epName);
            return true;
          }),
      },
    );

    if (chosen.question) {
      if (!progressive)
        throw new BadRequestException(
          'Question from service: ' + chosen.question,
        );

      // emit progressive requesting event
      const data = await this.eventListenersService.emit(
        new ProgressiveRequestEvent(srcId, reqEvent, cenAdaptor, {
          progressive,
          // mapped,
        }),
      );
      if (!data.statusCode)
        // direct return, no persistent async
        return this.map2EndpointsProgressive(data, reqEvent);

      if (data.statusCode == 2)
        // pending
        return { data: reqEvent, resumeFunName: 'map2EndpointsProgressive' };
      throw new HttpException(data.message, data.statusCode);
    }

    const chosenEps = chosen.usedEndpoints.map((ep) => ep.epName);
    const eps = reqEvent.context.endpoints.filter((ep) =>
      chosenEps.includes(ep.name),
    );
    if (!eps.length)
      throw new BadRequestException(
        'Error: mapped to empty endpoints: ' + chosen,
      );

    reqEvent.context.endpoints = eps;
    reqEvent.context.map2Endpoints = chosen;
  }

  private _hasOpenAPIProperty(json, propertyName) {
    // Base case: if the object is null or not an object, return false
    if (typeof json !== 'object' || json === null) return false;

    // Check if the current level has the property
    if (propertyName in json) return true;

    // Check special case for arrays: look into 'items'
    if (json.type === 'array' && json.items) {
      return this._hasOpenAPIProperty(json.items, propertyName);
    }

    // Recursively check in the properties of the current object
    if (json.properties) {
      for (const key of Object.keys(json.properties)) {
        if (this._hasOpenAPIProperty(json.properties[key], propertyName)) {
          return true;
        }
      }
    }

    // If no matches found, return false
    return false;
  }

  /**
   * map req to an API endpoint
   * - if epName means invoke: map to exact endpoint, load/gen mapArgs(req), no question
   * - if no epName request: generate exec macro function, may question
   */
  async map2Endpoints(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    if (!endpoints?.length)
      throw new NotFoundException(
        'No endpoints for mapping, ClientRequestEvent#' + reqEvent.id,
      );

    // FIXME map from all taskId events

    // if epName, try find mapArgs function by [cepAdaptor, epName]
    const mapped = await (reqEvent.context.epName
      ? this._map2Endpoint(reqEvent, endpoints)
      : this._map2Endpoints(reqEvent, endpoints));
    if (!mapped) return;
    if ('data' in mapped) return mapped;

    // reqEvent.context.map2Endpoints = mapped;
  }

  /** progressive not supported for invoking */
  protected async _map2Endpoint(
    reqEvent: ClientRequestEvent,
    endpoints: EndpointDto[],
  ) {
    const {
      id,
      srcId,
      dataType: cenAdaptor,
      context: { callgentName, epName, req, tgtEvents },
    } = reqEvent;
    const endpoint: EndpointDto = endpoints.find((e) => e.name == epName);
    if (!endpoint)
      throw new NotFoundException('map2Endpoint not found of name:' + epName);

    // load existing (srcId, epName)
    const prisma = this.txHost.tx as PrismaClient;
    const rec = await prisma.req2ArgsRepo.findUnique({
      select: { req2Args: true },
      where: { cepId_sepId: { cepId: srcId, sepId: endpoint.id } },
    });
    if (rec) return rec;

    // generate
    if (!endpoint.params || Object.keys(endpoint.params).length == 0)
      return { req2Args: '() => ({})', requestArgs: {} }; // no params

    const mapped = await this.llmService.query(
      'map2Endpoint',
      { req, epName, callgentName, cepAdaptor: cenAdaptor, endpoints },
      {
        resultSchema: { req2Args: '' },
        bizKey: id,
        validate: (data) => {
          try {
            const fun = Utils.toFunction(data.req2Args);
            (data as any).requestArgs = fun(req);
          } catch (e) {
            throw new Error(
              '[map2Endpoint] Wrong generation `req2Args` function: ' +
                e.message,
            );
          }
          return true;
        },
      },
    );
    return mapped;
  }

  protected async _map2Endpoints(
    reqEvent: ClientRequestEvent,
    endpoints: EndpointDto[],
  ) {
    const {
      id,
      srcId,
      dataType: cenAdaptor,
      context: { callgentName, epName, progressive, req },
    } = reqEvent;

    // remove unsuccess responses
    endpoints = endpoints.map((item) => {
      const r = { ...item };
      const successResponse = {};
      Object.entries(item.responses).forEach(([k, v]) => {
        if (k.startsWith('2') || k.startsWith('3') || k == 'default')
          successResponse[k] = v;
      });
      r.responses = successResponse;
      return r;
    });

    const mapped = await this.llmService.query(
      'map2Endpoints',
      {
        req,
        epName,
        callgentName,
        cenAdaptor,
        endpoints,
      },
      {
        resultSchema: {
          question: '',
          endpoints: [''],
          summary: '',
          instruction: '',
          requestArgs: {},
          macroParams: { parameters: [], requestBody: {} },
          macroResponse: {},
          memberFunctions: { main: '' },
        },
        bizKey: id,
      },
    );

    if (mapped.question) {
      if (!progressive)
        throw new BadRequestException(
          'Question from service: ' + mapped.question,
        );

      // emit progressive requesting event
      const data = await this.eventListenersService.emit(
        new ProgressiveRequestEvent(srcId, reqEvent, cenAdaptor, {
          progressive,
          // mapped,
        }),
      );
      if (!data.statusCode)
        // direct return, no persistent async
        return this.map2EndpointsProgressive(data, reqEvent);

      if (data.statusCode == 2)
        // pending
        return { data: reqEvent, resumeFunName: 'map2EndpointsProgressive' };
      throw new HttpException(data.message, data.statusCode);
    } else {
      const endpoints = reqEvent.context.endpoints.filter((ep) =>
        mapped.endpoints.includes(ep.name),
      );
      if (!endpoints.length)
        throw new BadRequestException(
          'Error: mapped to none endpoint: ' + mapped,
        );
      reqEvent.context.endpoints = endpoints;

      return mapped;
    }
  }

  /** progressive response, to continue mapping */
  async map2EndpointsProgressive(
    data: ProgressiveRequestEvent,
    reqEvent?: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    // handle resp
  }

  // private _args2List30x(args: object) {
  //   const list = [];
  //   if (!args) return list;
  //   const { parameters, requestBody } = args as any;
  //   parameters?.forEach((p) => {
  //     // if (!p.value)
  //     //   throw new BadRequestException('Missing value for parameter:' + p.name);
  //     list.push(p);
  //   });
  //   if (requestBody) {
  //     // if (!requestBody.value)
  //     //   throw new BadRequestException('Missing value for requestBody');
  //     list.push({
  //       ...requestBody,
  //       name: 'Request Body',
  //       // content: this._formatMediaType(requestBody.content),
  //     }); // TODO format
  //   }
  //   return list;
  // }

  /** convert resp content into one of fun.responses */
  async convert2Response(
    requestArgs: { [name: string]: any },
    resp: string,
    ep: EndpointDto,
    eventId: string,
  ) {
    requestArgs = requestArgs
      ? Object.entries(requestArgs).map(([name, value]) => ({ name, value }))
      : [];
    const mapped = await this.llmService.query(
      'convert2Response',
      { requestArgs, resp, ep },
      {
        resultSchema: { statusCode: 200, data: null },
        bizKey: eventId,
      },
    ); // TODO validating `mapping`

    return mapped;
  }

  /**
   * @param total - whether summarizing from all eps of entry
   * @returns
   */
  async summarizeEntry(data: {
    entry: {
      id: string;
      summary?: string;
      instruction?: string;
      callgentId?: string;
    };
    news?: Omit<Endpoint, 'securities' | 'createdAt'>[];
    olds?: Omit<Endpoint, 'securities' | 'createdAt'>[];
    totally?: boolean;
  }) {
    const result = await this.llmService.query('summarizeEntry', data, {
      resultSchema: { summary: '', instruction: '', totally: true },
      bizKey: data.entry.id,
    });
    return result;
  }

  /**
   * @param total - whether summarizing from all eps of entry
   * @returns
   */
  async summarizeCallgent(data: {
    callgent: {
      id: string;
      summary?: string;
      instruction?: string;
    };
    news?: Omit<Entry, 'securities' | 'createdAt'>[];
    olds?: Omit<Entry, 'securities' | 'createdAt'>[];
    totally?: boolean;
  }) {
    const result = await this.llmService.query('summarizeCallgent', data, {
      resultSchema: { summary: '', instruction: '', totally: true },
      bizKey: data.callgent.id,
    });

    return result;
  }

  async genVue1Route(data: {
    requirement: string;
    callgent: { name: string; summary: string; instruction: string };
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue1Route', data, {
      resultSchema: [
        {
          name: '',
          path: '',
          component: '',
          file: '',
          title: '',
          summary: '',
          instruction: '',
          distance: 0,
        },
      ],
      bizKey: data.bizKey,
    });

    return result;
  }

  async genVue2Components(data: {
    view: {
      name: string;
      path: string;
      file: string;
      title: string;
      summary: string;
      instruction: string;
    };
    otherViews: {
      name: string;
      path: string;
      title: string;
      summary: string;
    }[];
    components: {
      [comName: string]: {
        file: string;
        // props: string[];
        summary: string;
        instruction: string;
        inViews: string[];
      };
    };
    endpoints: {
      id: string;
      summary: string;
      description: string;
      params: [];
    }[];
    packages: string[];
    bizKey: string;
  }) {
    let compName = '';
    const result = await this.llmService.query('genVue2Components', data, {
      resultSchema: {
        [compName]: {
          file: '',
          endpoints: [''],
          // props: [''],
          summary: '',
          instruction: '',
        },
      },
      bizKey: data.bizKey,
      // validate endpoints exists
      validate: (gen) =>
        Object.entries(gen).every(([compName, comp]) =>
          comp.endpoints.every((epName) => {
            if (data.endpoints.find((ep) => (ep as any).name === epName))
              return true;
            throw new Error(
              `endpoint '${epName}' not found for component: ${compName}`,
            );
          }),
        ),
    });

    return result;
  }

  async genVue3Component(data: {
    components: {
      name: string;
      // props: string[];
      file?: string;
      summary: string;
      instruction?: string;
      endpoints?: { name: string; params: object; responses: object }[];
    }[];
    relatedViews: {
      name: string;
      title: string;
      summary: string;
      components: string[];
    }[];
    otherViews: {
      name: string;
      path: string;
      summary: string;
    }[];
    stores: {
      file: string;
      state: object;
      actions: string[];
      getters: object[];
    }[];
    packages: string[];
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue3Component', data, {
      resultSchema: {
        code: '',
        packages: [''],
        importedStores: [
          { file: '', name: '', state: {}, actions: [''], getters: [{}] },
        ],
        spec: {
          props: [''],
          slots: [{ name: '', summary: '' }],
          // events: [{ name: '', summary: '', payload: {} }],
          importedComponents: ['ComponentName', 'may empty array'],
        },
      },
      bizKey: data.bizKey,
      validate: (gen) =>
        gen.packages.every((p) => {
          if (p.lastIndexOf('@') <= 0)
            throw new Error('package name should be like `name@version`: ' + p);
          return true;
        }) &&
        (!gen.spec.importedComponents ||
          gen.spec.importedComponents.every((c) => {
            if (data.components.find((comp) => comp.name === c)) return true;
            throw new Error(
              `in $.spec.importedComponents: '${c}' isn't a self-defined components, must not listed here!`,
            );
          })),
    });

    return result;
  }

  async genVue4Store(data: {
    store: {
      file: string;
      state: object;
      actions: string[];
      getters: object[];
      endpoints: {
        name: any;
        summary: any;
        description: any;
        params: any;
        responses: any;
      }[];
    };
    packages: string[];
    apiBaseUrl: string;
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue4Store', data, {
      resultSchema: { code: '', packages: [''] },
      bizKey: data.bizKey,
      validate: (gen) =>
        gen.packages.every((p) => {
          if (p.lastIndexOf('@') <= 0)
            throw new Error('package name should be like `name@version`: ' + p);
          return true;
        }),
    });
    return result;
  }

  async genVue5View(data: {
    view: {
      name: string;
      title: string;
      path: string;
      summary: string;
      instruction: string;
      file: string;
    };
    otherViews: {
      name: string;
      title: string;
      path: string;
    }[];
    components: {
      name: string;
      // props: string[];
      summary: string;
      instruction: string;
      file: string;
      spec: object;
    }[];
    packages: string[];
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue5View', data, {
      resultSchema: { code: '', packages: [''] },
      bizKey: data.bizKey,
      validate: (gen) =>
        gen.packages?.every((p) => {
          if (p.lastIndexOf('@') > 0) return true;
          throw new Error('package name should be like `name@version`');
        }),
    });
    return result;
  }
}
