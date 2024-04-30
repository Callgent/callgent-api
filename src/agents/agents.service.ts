import { BadRequestException, Injectable } from '@nestjs/common';
import { BotletFunctionDto } from '../botlet-functions/dto/botlet-function.dto';
import { AdaptedDataSource } from '../endpoints/adaptors/endpoint-adaptor.interface';
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

  async api2Function(
    format: string,
    handle: string,
    args: { [key: string]: string },
  ) {
    return this.llmService.template(
      'api2Function',
      {
        format,
        handle,
        ...args,
      },
      { funName: '', params: [''], documents: '', fullCode: '' },
    );
  }

  /** args mapping to a single invocation, w/o vars/flows/functions */
  async map2Function(reqEvent: ClientRequestEvent) {
    const {
      uuid,
      srcId,
      dataType: cepAdaptor,
      data: { botletName, req, funName, progressive },
      context: { tgtEvents },
    } = reqEvent;
    const botletFunctions = reqEvent.context
      .functions as unknown as BotletFunctionDto[];
    if (!botletFunctions?.length)
      throw new BadRequestException(
        'No functions for mapping, ClientRequestEvent#' + uuid,
      );

    // FIXME map from all targetId events

    const mapped = await this.llmService.template(
      'map2Function',
      {
        req,
        funName,
        botletName,
        cepAdaptor,
        botletFunctions,
      },
      { funName: '', mapping: '', question: '' },
    );
    reqEvent.context.function = mapped;

    if (mapped.question) {
      if (!progressive) throw new BadRequestException(mapped.question);

      // emit progressive requesting event
      const result = await this.eventListenersService.emit(
        new ProgressiveRequestEvent(srcId, uuid, cepAdaptor, { progressive }),
      );
      if (Array.isArray(result)) {
        const [, funName] = result;
        if (funName) return [reqEvent, 'map2FunctionProgressive'];
      }
    }
    return reqEvent;
  }

  /** progressive response, to continue mapping */
  async map2FunctionProgressive(reqEvent: ClientRequestEvent, resp?: any) {
    // handle resp
  }

  async genScript(
    BotletFunctions: { [botletName: string]: BotletFunctionDto[] },
    taskAction: TaskActionDto,
  ) {
    const ms = Object.values(BotletFunctions)?.flat();

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
    botlets: { uuid: string; name: string; summary: string }[],
    taskaAction: TaskActionDto,
  ) {}

  async routeAction(actions: BotletFunctionDto[], req: AdaptedDataSource) {
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
