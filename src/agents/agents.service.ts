import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { Endpoint } from '../endpoints/entities/endpoint.entity';
import { Entry } from '../entries/entities/entry.entity';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EventListenersService } from '../event-listeners/event-listeners.service';
import { ProgressiveRequestEvent } from './events/progressive-request.event';
import { LLMService } from './llm.service';

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
    const endpoints = reqEvent.context.endpoints as unknown as EndpointDto[];
    if (!endpoints?.length)
      throw new BadRequestException(
        'No endpoints for mapping, ClientRequestEvent#' + reqEvent.id,
      );

    // FIXME map from all taskId events

    // if epName, try find mapArgs function by [cepAdaptor, epName]
    const mapped = await (reqEvent.data.epName
      ? this._map2Endpoint(reqEvent)
      : this._map2Endpoints(reqEvent));
    if (!mapped) return;
    if ('data' in mapped) return mapped;

    reqEvent.context.map2Endpoints = mapped;
  }

  /** progressive not supported for invoking */
  protected async _map2Endpoint(reqEvent: ClientRequestEvent) {
    const {
      id,
      srcId,
      dataType: cenAdaptor,
      data: { callgentName, epName },
      context: { endpoints, tgtEvents, req },
    } = reqEvent;
    const endpoint: EndpointDto = endpoints[0];

    // load existing (srcId, epName)
    const prisma = this.txHost.tx as PrismaClient;
    const rec = await prisma.req2ArgsRepo.findUnique({
      select: { req2Args: true },
      where: { cepId_sepId: { cepId: srcId, sepId: endpoint.id } },
    });
    if (rec) return rec;

    // generate
    if (!endpoint.params || Object.keys(endpoint.params).length == 0)
      return { req2Args: '() => ({})', args: {} }; // no params

    const mapped = await this.llmService.template(
      'map2Endpoint',
      { req, epName, callgentName, cepAdaptor: cenAdaptor, endpoints },
      {
        returnType: { req2Args: '', args: {} },
        bizKey: id,
        validate: (data) => ((data.args = eval(data.req2Args)(req)), true),
      },
    );
    return mapped;
  }

  protected async _map2Endpoints(reqEvent: ClientRequestEvent) {
    const {
      id,
      srcId,
      dataType: cenAdaptor,
      data: { callgentName, epName, progressive },
      context: { endpoints, tgtEvents, req },
    } = reqEvent;

    const mapped = await this.llmService.template(
      'map2Endpoints',
      { req, epName, callgentName, cepAdaptor: cenAdaptor, endpoints },
      {
        returnType: {
          question: '',
          summary: '',
          description: '',
          endpoints: [''],
          components: [],
          args: {},
          macroParams: [],
          macroResponse: '',
          invokeEndpoints: '',
          wrapResp: '',
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
        new ProgressiveRequestEvent(srcId, id, cenAdaptor, {
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
    args: { name: string; value: any }[],
    resp: string,
    ep: EndpointDto,
    eventId: string,
  ) {
    args = args?.map((a) => ({ name: a.name, value: a.value })) || [];
    const mapped = await this.llmService.template(
      'convert2Response',
      { args, resp, ep },
      {
        returnType: { statusCode: 200, data: {} },
        bizKey: eventId,
      },
    ); // TODO validating `mapping`

    return { statusCode: mapped.statusCode, data: mapped.data };
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
}
