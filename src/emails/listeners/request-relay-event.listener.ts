import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JsonObject } from '@prisma/client/runtime/library';
import { EventListenersService } from '../../event-listeners/event-listeners.service';
import { EmailRelayKey } from '../emails.service';
import { EmailRelayEvent } from '../events/email-relay.event';

@Injectable()
export class RequestRelayListener {
  private readonly logger = new Logger(RequestRelayListener.name);
  constructor(private readonly eventListenersService: EventListenersService) {}

  @Transactional()
  @OnEvent(EmailRelayEvent.eventPrefix + EmailRelayKey.request)
  async handleEvent(event: EmailRelayEvent) {
    this.logger.debug('Handling event: %j', event);

    const { relayId: reqEventId, email } = event;
    // extract resp from msg
    const resp = email as object;
    const reqEvent = await this.eventListenersService.loadEvent(reqEventId);
    if (!reqEvent || reqEvent.eventType != 'CLIENT_REQUEST')
      return this.logger.error('Event not found: %j', event);

    reqEvent.data
      ? ((reqEvent.data as JsonObject).resp = resp)
      : (reqEvent.data = { resp });

    // resuming event chain
    this.eventListenersService.resume(reqEvent);
  }
}
