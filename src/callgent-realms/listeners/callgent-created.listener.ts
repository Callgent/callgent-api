import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { EntryType } from '@prisma/client';
import { CallgentCreatedEvent } from '../../callgents/events/callgent-created.event';
import { CreateEntryDto } from '../../entries/dto/create-entry.dto';
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
    private readonly configService: ConfigService,
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
        // callgent jwt
        {
          callgentId: callgent.id,
          authType: 'jwt',
          scheme: {
            in: 'header',
            validationUrl: 'http://local',
            name: 'x-callgent-authorization',
            description: 'Callgent User Authentication',
          },
          enabled: true,
          tenantPk_: undefined,
        },
      ].map(async (e) => this.callgentRealmsService.create(e, { pk: true })),
    );
    // init entries after securities is ready
    return this._initEntries(event);
  }

  private async _initEntries(event: CallgentCreatedEvent) {
    this.logger.debug('%j: Handling event,', event);

    const { callgent } = event;
    if (callgent.forkedPk) return; // forked callgent

    // add default entries
    const defaultEntries: (CreateEntryDto & {
      createdBy: string;
      adaptorKey: string;
      tenantPk_?: number;
    })[] = [
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
      // system server entry, used by adaptor default script
      {
        callgentId: callgent.id,
        type: 'SERVER' as EntryType,
        adaptorKey: 'Callgent',
        host: this.configService.get('SYSTEM_CALLGENT_ID'),
        createdBy: this.configService.get('ADMIN_USER_ID'),
        tenantPk_: 0,
      },
    ];
    const results = await Promise.all(
      defaultEntries.map(async (e) =>
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
