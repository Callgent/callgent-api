import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CallgentCreatedEvent } from '../../callgents/events/callgent-created.event';
import { EndpointsService } from '../endpoints.service';
import { EmailRelayKey, EmailsService } from '../../emails/emails.service';

@Injectable()
export class CallgentCreatedListener {
  private readonly logger = new Logger(CallgentCreatedListener.name);
  constructor(
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
    private readonly emailsService: EmailsService,
  ) {}

  /** create a callgent with default api client endpoint, and Email client/server endpoint */
  @Transactional()
  @OnEvent(CallgentCreatedEvent.eventName, { async: false })
  async handleEvent(event: CallgentCreatedEvent) {
    this.logger.debug('Handling event: %j', event);

    const callgent = event.callgent;

    // add default endpoints
    const results = await Promise.all([
      // API client endpoint
      this.endpointsService
        .create({
          callgentId: callgent.id,
          type: 'CLIENT',
          adaptorKey: 'restAPI',
          host: `/api/callgents/${callgent.id}/{id}/invoke/api/`,
          createdBy: callgent.createdBy,
        })
        .then((endpoint) => {
          // no await init, it may be slow, init must restart a new tx
          this.endpointsService.init(endpoint.id, []);
          return endpoint;
        }),

      // TODO API event endpoint

      // Email client endpoint
      this.endpointsService
        .create({
          callgentId: callgent.id,
          type: 'CLIENT',
          adaptorKey: 'Email',
          host: this.emailsService.getRelayAddress(
            callgent.id,
            EmailRelayKey.callgent,
          ),
          createdBy: callgent.createdBy,
        })
        .then((endpoint) => {
          // no await init, it may be slow
          this.endpointsService.init(endpoint.id, []);
          return endpoint;
        }),
    ]);

    return results;
  }
}
