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
import { ProgressiveRequestEvent } from './events/progressive-request.event';
import { LLMService } from './llm.service';
import { Utils } from '../infras/libs/utils';

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

    reqEvent.context.map2Endpoints = mapped;
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

    const mapped = await this.llmService.template(
      'map2Endpoint',
      { req, epName, callgentName, cepAdaptor: cenAdaptor, endpoints },
      {
        returnType: { req2Args: '' },
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

    const mapped = await this.llmService.template(
      'map2Endpoints',
      {
        req,
        epName,
        callgentName,
        cenAdaptor,
        endpoints,
      },
      {
        returnType: {
          question: '',
          endpoints: [''],
          summary: '',
          instruction: '',
          requestArgs: {},
          macroParams: [],
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
      const {
        data: prEvent,
        statusCode,
        message,
      } = await this.eventListenersService.emit(
        new ProgressiveRequestEvent(srcId, reqEvent, cenAdaptor, {
          progressive,
          // mapped,
        }),
      );
      if (!statusCode)
        // direct return, no persistent async
        return this.map2EndpointsProgressive(prEvent, reqEvent);

      if (statusCode == 2)
        // pending
        return { data: reqEvent, resumeFunName: 'map2EndpointsProgressive' };
      throw new HttpException(message, statusCode);
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
    const mapped = await this.llmService.template(
      'convert2Response',
      { requestArgs, resp, ep },
      {
        returnType: { statusCode: 200, data: null },
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
    const result = await this.llmService.template('summarizeEntry', data, {
      returnType: { summary: '', instruction: '', totally: true },
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
    const result = await this.llmService.template('summarizeCallgent', data, {
      returnType: { summary: '', instruction: '', totally: true },
      bizKey: data.callgent.id,
    });

    return result;
  }

  async genVue1Route(data: {
    requirement: string;
    callgent: { name: string; summary: string; instruction: string };
    bizKey: string;
  }) {
    const result = await this.llmService.template('genVue1Route', data, {
      returnType: [
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
    const result = await this.llmService.template('genVue2Components', data, {
      returnType: {
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
    const result = await this.llmService.template('genVue3Component', data, {
      returnType: {
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
    const result = await this.llmService.template('genVue4Store', data, {
      returnType: { code: '', packages: [''] },
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
    const result = await this.llmService.template('genVue5View', data, {
      returnType: { code: '', packages: [''] },
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
