import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CallgentCreatedEvent } from '../../callgents/events/callgent-created.event';
import { EndpointsService } from '../endpoints.service';

@Injectable()
export class CallgentCreatedListener {
  private readonly logger = new Logger(CallgentCreatedListener.name);
  constructor(
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
  ) {}

  /** create a callgent with default api client endpoint, and email client/server endpoint */
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
          callgentUuid: callgent.uuid,
          type: 'CLIENT',
          adaptorKey: 'restAPI',
          host: {},
          createdBy: callgent.createdBy,
        })
        .then((endpoint) => {
          // no await init, it may be slow, TODO: tx invalid
          this.endpointsService.init(endpoint.uuid, []);
          return endpoint;
        }),

      // TODO API event endpoint

      // email client endpoint
      this.endpointsService
        .create({
          callgentUuid: callgent.uuid,
          type: 'CLIENT',
          adaptorKey: 'email',
          host: { email: `callgent+${callgent.uuid}@my.callgent.com` },
          createdBy: callgent.createdBy,
        })
        .then((endpoint) => {
          // no await init, it may be slow
          this.endpointsService.init(endpoint.uuid, []);
          return endpoint;
        }),
    ]);

    return results;
  }
}
