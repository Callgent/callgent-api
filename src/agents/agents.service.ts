import { Injectable } from '@nestjs/common';
import { BotletMethodDto } from '../botlet-methods/dto/botlet-method.dto';
import { AdaptedDataSource } from '../endpoints/adaptors/endpoint-adaptor.interface';
import { TaskActionDto } from '../task-actions/dto/task-action.dto';
import { LLMService as LLMService } from './llm.service';

@Injectable()
export class AgentsService {
  constructor(private readonly llmService: LLMService) {}

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
      { signature: '', documents: '', arrowFunc: '' },
    );
  }

  async genScript(
    botletMethods: { [botletName: string]: BotletMethodDto[] },
    taskAction: TaskActionDto,
  ) {
    const ms = Object.values(botletMethods)?.flat();
    
    if (ms.length > 1) {
      // routing
    }

    return this.llmService.template(
      'api2Function',
      {
        format,
        handle,
        ...args,
      },
      { signature: '', documents: '', arrowFunc: '' },
    );
  }

  async genPseudoCmd(
    botlets: { uuid: string; name: string; summary: string }[],
    taskaAction: TaskActionDto,
  ) {}

  async routeAction(actions: BotletMethodDto[], req: AdaptedDataSource) {
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
