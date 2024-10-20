import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AgentsService } from '../../agents/agents.service';
import { CallgentsService } from '../../callgents/callgents.service';
import { EntriesService } from '../../entries/entries.service';
import { EntriesChangedEvent } from '../../entries/events/entries-changed.event';

@Injectable()
export class EntriesChangedListener {
  private readonly logger = new Logger(EntriesChangedListener.name);
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
    const { callgent, news, olds } = event.data;
    if (typeof callgent.summary === 'undefined')
      event.data.callgent = await this.callgentsService.findOne(callgent.id, {
        id: true,
        summary: true,
        instruction: true,
      });

    let result = await this.agentsService.summarizeCallgent(event.data);
    if (result.total) {
      // totally re-summarize
      const news = await this.entriesService.findAll({
        where: { callgentId: callgent.id },
      });
      result = await this.agentsService.summarizeCallgent({
        callgent,
        news,
        total: true,
      });
    }
    await this.entriesService.update(callgent.id, {
      summary: result.summary,
      instruction: result.instruction,
    });
  }
}
