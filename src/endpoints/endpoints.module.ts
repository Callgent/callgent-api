import { Module } from '@nestjs/common';
import { RestAPIAdaptor } from './adaptors/builtin/restapi/restapi.adaptor';
import { WebpageAdaptor } from './adaptors/builtin/web/webpage.adaptor';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { BotletCreatedListener } from './listeners/botlet-created.listener';

@Module({
  providers: [
    EndpointsService,
    BotletCreatedListener,
    {
      provide: 'restAPI-EndpointService',
      useClass: RestAPIAdaptor,
    },
    {
      provide: 'webpage-EndpointService',
      useClass: WebpageAdaptor,
    },
  ],
  controllers: [EndpointsController],
})
export class EndpointsModule {}
