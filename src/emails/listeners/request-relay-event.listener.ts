import { Propagation, Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JsonObject } from '@prisma/client/runtime/library';
import { EventListenersService } from '../../event-listeners/event-listeners.service';
import { EmailRelayKey } from '../emails.service';
import { EmailRelayEvent } from '../events/email-relay.event';
import { InvokeCtx } from '../../invoke/invoke.service';

@Injectable()
export class RequestRelayListener {
  private readonly logger = new Logger(RequestRelayListener.name);
  constructor(private readonly eventListenersService: EventListenersService) {}

  @Transactional(Propagation.RequiresNew)
  @OnEvent(EmailRelayEvent.eventPrefix + EmailRelayKey.request, { async: true }) // always async
  async handleEvent(event: EmailRelayEvent) {
    this.logger.debug('%j: Handling event,', event);

    const { relayId: reqEventId, email } = event;
    // extract resp from msg
    const resp = email as object;
    await this.eventListenersService.resume(reqEventId, async (event) => {
      // update sep response
      const invocation: InvokeCtx = (event.context as any).invocation;
      invocation.sepInvoke.response = { data: resp };
      return event;
    });
  }
}
