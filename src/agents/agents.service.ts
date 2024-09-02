import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { CallgentFunctionDto } from '../callgent-functions/dto/callgent-function.dto';
import { AdaptedDataSource } from '../endpoints/adaptors/endpoint-adaptor.base';
import { TaskActionDto } from '../task-actions/dto/task-action.dto';
import { LLMService } from './llm.service';
import { ClientRequestEvent } from '../endpoints/events/client-request.event';
import { EventListenersService } from '../event-listeners/event-listeners.service';
import { ProgressiveRequestEvent } from './events/progressive-request.event';

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
  ): Promise<void | { data: ClientRequestEvent; callbackName?: string }> {
    const {
      id,
      srcId,
      dataType: cepAdaptor,
      data: { callgentName, req, funName, progressive },
      context: { tgtEvents },
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
      {
        req,
        funName,
        callgentName,
        cepAdaptor,
        callgentFunctions,
      },
      { endpoint: '', args: '', mapping: '', question: '' },
    ); // TODO check `funName` exists in callgentFunctions, validating `mapping`
    reqEvent.context.map2Function = mapped;

    if (mapped.question) {
      if (!progressive)
        throw new BadRequestException(
          'Question from service: ' + mapped.question,
        );

      // emit progressive requesting event
      const { data: prEvent, statusCode } =
        await this.eventListenersService.emit(
          new ProgressiveRequestEvent(srcId, id, cepAdaptor, {
            progressive,
            // mapped,
          }),
        );
      if (!statusCode)
        // direct return, no persistent async
        return this.map2FunctionProgressive(prEvent, reqEvent);

      if (statusCode == 1)
        // pending
        return { data: reqEvent, callbackName: 'map2FunctionProgressive' };
      throw new HttpException(prEvent.message, statusCode);
    } else {
      const functions = reqEvent.context.functions.filter(
        (f) => f.name == mapped.endpoint,
      );
      if (functions?.length != 1)
        throw new BadRequestException('Failed to map to function: ' + mapped);
      reqEvent.context.functions = functions;
    }
  }

  /** progressive response, to continue mapping */
  async map2FunctionProgressive(
    data: ProgressiveRequestEvent,
    reqEvent?: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; callbackName?: string }> {
    // handle resp
  }

  async genScript(
    CallgentFunctions: { [callgentName: string]: CallgentFunctionDto[] },
    taskAction: TaskActionDto,
  ) {
    const ms = Object.values(CallgentFunctions)?.flat();

    if (ms.length > 1) {
      // routing
    }

    // return this.llmService.template(
    //   'api2Function',
    //   {
    //     format,
    //     handle,
    //     ...args,
    //   },
    //   { signature: '', documents: '', fullCode: '' },
    // );
  }

  async genPseudoCmd(
    callgents: { id: string; name: string; summary: string }[],
    taskaAction: TaskActionDto,
  ) {}

  async routeAction(actions: CallgentFunctionDto[], req: AdaptedDataSource) {
    if (!actions?.length) return;
    // FIXME：是否需要task上下文来决定路由，
    return actions[0];
  }

  /** map request params from task ctx */
  async mapParams(content: any, req: AdaptedDataSource) {
    // 从任务上下文中获取参数，并返回标准json参数结构？由server适配器封装为想要的格式
    return [];
  }
}
