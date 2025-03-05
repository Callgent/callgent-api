import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EntryType } from '@prisma/client';
import { CallgentCreatedEvent } from '../../callgents/events/callgent-created.event';
import { EntriesService } from '../../entries/entries.service';
import { CallgentRealmsService } from '../callgent-realms.service';

@Injectable()
export class CallgentCreatedListener {
  private readonly logger = new Logger(CallgentCreatedListener.name);
  constructor(
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
  ) {}

  /** create a callgent with default api client entry, and Email client/server entry */
  @Transactional()
  @OnEvent(CallgentCreatedEvent.eventName, {
    suppressErrors: false,
    prependListener: true,
  })
  async handleEvent(event: CallgentCreatedEvent) {
    this.logger.debug('%j: Handling event,', event);

    const callgent = event.callgent;
    if (callgent.forkedPk) return; // forked callgent

    // add local realm securities
    await Promise.all(
      [
        // callgent api-key
        {
          callgentId: callgent.id,
          authType: 'apiKey',
          scheme: {
            provider: 'local',
            type: 'apiKey',
            name: 'x-callgent-api-key',
            in: 'header',
            description: 'Callgent `local` apiKey authentication',
          },
          enabled: true,
        },
        // callgent jwt
        {
          callgentId: callgent.id,
          authType: 'jwt',
          scheme: {
            provider: 'local',
            type: 'jwt',
            name: 'x-callgent-authorization',
            in: 'header',
            description: 'Callgent `local` User authentication',
          },
          enabled: true,
        },
      ].map(async (e) =>
        this.callgentRealmsService.create(e, {
          realmKey: true,
          authType: true,
        }),
      ),
    );
    // init entries after securities is ready
    return this._initEntries(event);
  }

  private async _initEntries(event: CallgentCreatedEvent) {
    this.logger.debug('%j: Handling event,', event);

    const { callgent } = event;
    if (callgent.forkedPk) return; // forked callgent

    // add default entries
    const results = await Promise.all(
      [
        // API client entry
        {
          callgentId: callgent.id,
          type: 'CLIENT' as EntryType,
          adaptorKey: 'restAPI',
          createdBy: callgent.createdBy,
        },
        // Email client entry
        {
          callgentId: callgent.id,
          type: 'CLIENT' as EntryType,
          adaptorKey: 'Email',
          createdBy: callgent.createdBy,
        },
        // TODO API event entry
      ].map(async (e) =>
        this.entriesService.create(e).then((entry) => {
          // no await init, it may be slow, init must restart a new tx
          this.entriesService.init(entry.id, []);
          return entry;
        }),
      ),
    );
    return results;
  }
}
