import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { AgentsService } from '../../agents/agents.service';
import { EntriesService } from '../../entries/entries.service';
import { EntriesChangedEvent } from '../../entries/events/entries-changed.event';
import { EndpointsService } from '../endpoints.service';
import { EndpointsChangedEvent } from '../events/endpoints-changed.event';

/** summarize entry when eps changed */
@Injectable()
export class EndpointsChangedSumEntryListener {
  private readonly logger = new Logger(EndpointsChangedSumEntryListener.name);
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
  @OnEvent(EndpointsChangedEvent.eventName, { async: true })
  async handleEvent(event: EndpointsChangedEvent) {
    this.logger.debug('Handling event: %j', event);

    // re-summarize entry summary/instruction
    let { entry: oldEntry } = event.data;
    if (!oldEntry.callgentId)
      oldEntry = event.data.entry = await this.entriesService.findOne(
        oldEntry.id,
      );

    let result = await this.agentsService.summarizeEntry(event.data);
    if (result.totally) {
      // totally re-summarize
      const news = await this.endpointsService.findAll({
        where: { entryId: oldEntry.id },
      });
      if (!news.length) return;

      result = await this.agentsService.summarizeEntry({
        entry: event.data.entry,
        news,
        totally: true,
      });
    }

    if (
      result.summary === oldEntry.summary &&
      result.instruction === oldEntry.instruction
    )
      return;
    const newEntry = await this.entriesService
      .update(
        oldEntry.id,
        {
          summary: result.summary,
          instruction: result.instruction,
        },
        { pk: null },
      )
      .catch((err) => {
        this.logger.error('Failed to update entry: %j', err);
        throw err;
      });
    // bubble up to the callgent
    this.eventEmitter.emitAsync(
      EntriesChangedEvent.eventName,
      new EntriesChangedEvent({
        callgent: { id: oldEntry.callgentId },
        news: [newEntry],
        olds: [{ ...oldEntry, pk: newEntry.pk } as any],
      }),
    );

    return newEntry;
  }
}
