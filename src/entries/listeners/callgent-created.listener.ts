import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CallgentCreatedEvent } from '../../callgents/events/callgent-created.event';
import { EntriesService } from '../entries.service';

@Injectable()
export class CallgentCreatedListener {
  private readonly logger = new Logger(CallgentCreatedListener.name);
  constructor(
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
  ) {}

  /** create a callgent with default api client entry, and Email client/server entry */
  @Transactional()
  @OnEvent(CallgentCreatedEvent.eventName, { suppressErrors: false })
  async handleEvent(event: CallgentCreatedEvent) {
    this.logger.debug('%j: Handling event,', event);

    const callgent = event.callgent;
    if (callgent.forkedPk) return; // forked callgent

    // add default entries
    const results = await Promise.all([
      // API client entry
      this.entriesService
        .create({
          callgentId: callgent.id,
          type: 'CLIENT',
          adaptorKey: 'restAPI',
          createdBy: callgent.createdBy,
        })
        .then((entry) => {
          // no await init, it may be slow, init must restart a new tx
          this.entriesService.init(entry.id, []);
          return entry;
        }),

      // TODO API event entry

      // Email client entry
      this.entriesService
        .create({
          callgentId: callgent.id,
          type: 'CLIENT',
          adaptorKey: 'Email',
          createdBy: callgent.createdBy,
        })
        .then((entry) => {
          // no await init, it may be slow
          this.entriesService.init(entry.id, []);
          return entry;
        }),
    ]);

    return results;
  }
}
