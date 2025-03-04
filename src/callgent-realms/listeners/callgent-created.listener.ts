import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CallgentCreatedEvent } from '../../callgents/events/callgent-created.event';
import { CallgentRealmsService } from '../callgent-realms.service';

@Injectable()
export class CallgentCreatedListener {
  private readonly logger = new Logger(CallgentCreatedListener.name);
  constructor(
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {}

  /** create a callgent with default api client entry, and Email client/server entry */
  @Transactional()
  @OnEvent(CallgentCreatedEvent.eventName, { suppressErrors: false })
  async handleEvent(event: CallgentCreatedEvent) {
    this.logger.debug('%j: Handling event,', event);

    const callgent = event.callgent;
    if (callgent.forkedPk) return; // forked callgent

    // add local realm securities
    const results = await Promise.all(
      [
        // callgent jwt
        {
          callgentId: callgent.id,
          authType: 'jwt',
          scheme: {
            provider: 'local',
            type: 'jwt',
            name: 'x-callgent-authorization',
            in: 'header',
            description: 'Callgent `local` JWT authentication',
          },
          enabled: true,
        },
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
      ].map(async (e) => this.callgentRealmsService.create(e)),
    );

    return results;
  }
}
