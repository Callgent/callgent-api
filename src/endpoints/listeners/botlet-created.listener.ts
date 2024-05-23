import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BotletCreatedEvent } from '../../botlets/events/botlet-created.event';
import { EndpointsService } from '../endpoints.service';

@Injectable()
export class BotletCreatedListener {
  private readonly logger = new Logger(BotletCreatedListener.name);
  constructor(
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
  ) {}

  /** create a botlet with default api receiver endpoint, and mail receiver/sender endpoint */
  @Transactional()
  @OnEvent(BotletCreatedEvent.eventName, { async: false })
  async handleEvent(event: BotletCreatedEvent) {
    this.logger.debug('Handling event: %j', event);

    const botlet = event.botlet;

    // add default endpoints
    const results = await Promise.all([
      // API client endpoint
      this.endpointsService
        .create({
          botletUuid: botlet.uuid,
          type: 'CLIENT',
          adaptorKey: 'restAPI',
          host: {},
          createdBy: botlet.createdBy,
        })
        .then((endpoint) => {
          // no await init, it may be slow
          this.endpointsService.init(endpoint.uuid, []);
          return endpoint;
        }),

      // TODO API event endpoint

      // mail client endpoint
      this.endpointsService
        .create({
          botletUuid: botlet.uuid,
          type: 'CLIENT',
          adaptorKey: 'mail',
          host: { mail: `botlet+${botlet.uuid}@c.botlet.io` },
          createdBy: botlet.createdBy,
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
