import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { AgentsService } from '../../agents/agents.service';
import { EntriesService } from '../../entries/entries.service';
import { EntriesChangedEvent } from '../../entries/events/entries-changed.event';
import { EndpointsService } from '../endpoints.service';
import { EndpointsChangedEvent } from '../events/endpoints-changed.event';

@Injectable()
export class EndpointsChangedListener {
  private readonly logger = new Logger(EndpointsChangedListener.name);
  constructor(
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    private readonly eventEmitter: EventEmitter2,
    @Inject('AgentsService')
    private readonly agentsService: AgentsService,
  ) {}

  /** create a callgent with default api client entry, and Email client/server entry */
  @Transactional(Propagation.RequiresNew)
  @OnEvent(EndpointsChangedEvent.eventName)
  async handleEvent(event: EndpointsChangedEvent) {
    this.logger.debug('Handling event: %j', event);

    // re-summarize entry summary/instruction
    const { entry, news, olds } = event.data;
    if (!entry.callgentId)
      event.data.entry = await this.entriesService.findOne(entry.id);

    let result = await this.agentsService.summarizeEntry(event.data);
    if (result.total) {
      // totally re-summarize
      const news = await this.endpointsService.findAll({
        where: { entryId: entry.id },
      });
      result = await this.agentsService.summarizeEntry({
        entry,
        news,
        total: true,
      });
    }
    await this.entriesService.update(entry.id, {
      summary: result.summary,
      instruction: result.instruction,
    });

    // bubble up to the callgent
    await this.eventEmitter.emitAsync(
      EntriesChangedEvent.eventName,
      new EntriesChangedEvent({ callgent: { id: entry.callgentId }, news: [] }),
    );
  }
}
