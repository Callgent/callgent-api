import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AgentsService } from '../../agents/agents.service';
import { CallgentsService } from '../../callgents/callgents.service';
import { EntriesService } from '../../entries/entries.service';
import { EntriesChangedEvent } from '../../entries/events/entries-changed.event';
import { Utils } from '../../infras/libs/utils';

/** summarize callgent when entries changed */
@Injectable()
export class EntriesChangedSumCallgentListener {
  private readonly logger = new Logger(EntriesChangedSumCallgentListener.name);
  constructor(
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    private readonly callgentsService: CallgentsService,
    @Inject('AgentsService')
    private readonly agentsService: AgentsService,
  ) {}

  /** create a callgent with default api client entry, and Email client/server entry */
  @Transactional(Propagation.RequiresNew)
  @OnEvent(EntriesChangedEvent.eventName, { async: true })
  async handleEvent(event: EntriesChangedEvent) {
    await Utils.sleep(1000); // wait for entries change committed
    this.logger.debug('%j: Handling event,', event);

    // re-summarize summary/instruction
    let { opBy, callgent } = event.data;
    if (typeof callgent.name === 'undefined')
      callgent = event.data.callgent = await this.callgentsService.findOne(
        callgent.id,
        {
          id: true,
          name: true,
          summary: true,
          instruction: true,
        },
      );

    let result = await this.agentsService.summarizeCallgent(event.data);
    if (result.totally) {
      // totally re-summarize
      const news = await this.entriesService.findAll({
        select: { pk: null },
        where: { callgentId: callgent.id, type: 'SERVER' },
      });
      if (!news.length) return;

      result = await this.agentsService.summarizeCallgent({
        opBy,
        callgent,
        news,
        totally: true,
      });
    }
    return this.callgentsService.update({
      id: callgent.id,
      summary: result.summary,
      instruction: result.instruction,
    });
  }
}
