import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { AgentsService } from '../../../../agents/agents.service';
import { ClientRequestEvent } from '../../../events/client-request.event';

@Injectable()
export class WebpageService {
  constructor(
    @Inject('AgentsService')
    private readonly agentsService: AgentsService,
  ) {}

  /** Generate webpage[view/route/model/view-model], then respond the src code */
  @Transactional()
  async genWebpages(
    data: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    data.stopPropagation = true; // stop event propagation

    // data.context.callgent
    // data.context.req: { requirement }
    // data.context.endpoints, target events,

    // 根据req和callgent概要，规划几个comps，区分showing/ref

    const route = await this.agentsService.genVue1Route({
      srcId: data.srcId,
      callgent: data.context.callgent,
      requirement: data.context.req.requirement,
    });

    return { data };
  }
}
