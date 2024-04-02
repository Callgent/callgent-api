import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BotletCreatedEvent } from '../../botlets/events/botlet-created.event';
import { EndpointsService } from '../endpoints.service';

@Injectable()
export class BotletCreatedListener {
  private readonly logger = new Logger(BotletCreatedListener.name);
  constructor(private readonly endpointsService: EndpointsService) {}

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
          host: { path: 'restAPI' },
          createdBy: botlet.createdBy,
        })
        .then((endpoint) => this.endpointsService.init(endpoint.uuid, [])),

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
        .then((endpoint) => this.endpointsService.init(endpoint.uuid, [])),

      // no default server endpoint
      // this.endpointsService.create({
      //   botletUuid: botlet.uuid,
      //   type: 'SERVER',
      //   adaptorKey: 'mail',
      //   authType: 'NONE',
      //   host: {},
      //   createdBy: botlet.createdBy,
      // }),
    ]);

    return results;
  }
}
