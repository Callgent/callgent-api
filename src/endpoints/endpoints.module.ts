import { Module } from '@nestjs/common';
import { MailAdaptor } from './adaptors/builtin/mail/mail.adaptor';
import { RestAPIAdaptor } from './adaptors/builtin/restapi/restapi.adaptor';
import { RestApiController } from './adaptors/builtin/restapi/restapi.controller';
import { WebpageAdaptor } from './adaptors/builtin/web/webpage.adaptor';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { BotletCreatedListener } from './listeners/botlet-created.listener';

@Module({
  providers: [
    EndpointsService,
    BotletCreatedListener,
    {
      provide: 'restAPI-EndpointAdaptor',
      useClass: RestAPIAdaptor,
    },
    {
      provide: 'webpage-EndpointAdaptor',
      useClass: WebpageAdaptor,
    },
    {
      provide: 'webpage-EndpointAdaptor',
      useClass: MailAdaptor,
    },
  ],
  controllers: [EndpointsController, RestApiController],
  exports: [EndpointsService],
})
export class EndpointsModule {}
