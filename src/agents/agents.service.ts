import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { CallgentFunctionDto } from '../callgent-functions/dto/callgent-function.dto';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EventListenersService } from '../event-listeners/event-listeners.service';
import { ProgressiveRequestEvent } from './events/progressive-request.event';
import { LLMService } from './llm.service';

@Injectable()
export class AgentsService {
  constructor(
    private readonly llmService: LLMService,
    private readonly eventListenersService: EventListenersService,
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
  //     { funName: '', params: [''], documents: '', fullCode: '' },
  //   );
  // }

  /**
   * map req to an API function, generate args(with vars/conversations), argsMapping function if applicable
   */
  async map2Function(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const {
      id,
      srcId,
      dataType: cepAdaptor,
      data: { callgentName, funName, progressive },
      context: { tgtEvents, req },
    } = reqEvent;
    const callgentFunctions = reqEvent.context
      .functions as unknown as CallgentFunctionDto[];
    if (!callgentFunctions?.length)
      throw new BadRequestException(
        'No functions for mapping, ClientRequestEvent#' + id,
      );

    // FIXME map from all targetId events

    // TODO how to use mapping function: for specific req & function

    const mapped = await this.llmService.template(
      'map2Function',
      { req, funName, callgentName, cepAdaptor, callgentFunctions },
      { endpoint: '', args: {}, mapping: '', question: '' },
      id,
    ); // TODO check `funName` exists in callgentFunctions, validating `mapping`
    reqEvent.context.map2Function = mapped;

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
        new ProgressiveRequestEvent(srcId, id, cepAdaptor, {
          progressive,
          // mapped,
        }),
      );
      if (!statusCode)
        // direct return, no persistent async
        return this.map2FunctionProgressive(prEvent, reqEvent);

      if (statusCode == 2)
        // pending
        return { data: reqEvent, resumeFunName: 'map2FunctionProgressive' };
      throw new HttpException(message, statusCode);
    } else {
      const functions = reqEvent.context.functions.filter(
        (f) => f.name == mapped.endpoint,
      );
      if (functions?.length != 1)
        throw new BadRequestException('Failed to map to function: ' + mapped);
      reqEvent.context.functions = functions;

      mapped.args = this._args2List30x(mapped.args);
    }
  }

  /** progressive response, to continue mapping */
  async map2FunctionProgressive(
    data: ProgressiveRequestEvent,
    reqEvent?: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    // handle resp
  }

  private _args2List30x(args: object) {
    const list = [];
    if (!args) return list;
    const { parameters, requestBody } = args as any;
    parameters?.forEach((p) => {
      if (!p.value)
        throw new BadRequestException('Missing value for parameter:' + p.name);
      list.push(p);
    });
    if (requestBody) {
      if (!requestBody.value)
        throw new BadRequestException('Missing value for requestBody');
      list.push({
        ...requestBody,
        name: 'Request Body',
        // content: this._formatMediaType(requestBody.content),
      }); // TODO format
    }
    return list;
  }

  /** convert resp content into one of fun.responses */
  async convert2Response(
    args: { name: string; value: any }[],
    resp: string,
    fun: CallgentFunctionDto,
    eventId: string,
  ) {
    args = args?.map((a) => ({ name: a.name, value: a.value })) || [];
    const mapped = await this.llmService.template(
      'convert2Response',
      { args, resp, fun },
      { statusCode: 200, data: {} },
      eventId,
    ); // TODO check `funName` exists in callgentFunctions, validating `mapping`

    return { statusCode: mapped.statusCode, data: mapped.data };
  }
}
