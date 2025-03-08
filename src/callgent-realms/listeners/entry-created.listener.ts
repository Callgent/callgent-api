import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EntryCreatedEvent } from '../../entries/events/entry-created.event';
import { CallgentRealmsService } from '../callgent-realms.service';
import { CallgentRealm } from '../entities/callgent-realm.entity';

/**
 * - add default security to new client entry
 */
@Injectable()
export class EntryCreatedListener {
  private readonly logger = new Logger(EntryCreatedListener.name);
  constructor(
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {}

  /** create a callgent with default api client entry, and Email client/server entry */
  @Transactional()
  @OnEvent(EntryCreatedEvent.eventName, { suppressErrors: false })
  async handleEvent(event: EntryCreatedEvent) {
    this.logger.debug('%j: Handling event,', event);

    const entry = event.entry;
    // already has securities, or not a client entry
    if (entry.securities?.length || entry.type != 'CLIENT') return;

    const securities = (await this.callgentRealmsService.findAll(
      entry.callgentId,
      { select: { id: true, authType: true, provider: true } },
    )) as any as CallgentRealm[];
    const defaultSecurity = securities.find(
      (s) => s.authType === 'jwt' && s.provider === 'local',
    );
    if (!defaultSecurity) return;
    const defaultRealm = { realmId: defaultSecurity.id };

    // add default realm to new entries
    return this.callgentRealmsService.updateSecurities('entry', entry.id, [
      defaultRealm,
    ]);
  }
}
