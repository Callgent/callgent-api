import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AgentsService } from '../../agents/agents.service';
import { CallgentsService } from '../../callgents/callgents.service';
import { EntriesService } from '../../entries/entries.service';
import { EntriesChangedEvent } from '../../entries/events/entries-changed.event';

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
  @OnEvent(EntriesChangedEvent.eventName)
  async handleEvent(event: EntriesChangedEvent) {
    this.logger.debug('Handling event: %j', event);

    // re-summarize summary/instruction
    let { callgent } = event.data;
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
