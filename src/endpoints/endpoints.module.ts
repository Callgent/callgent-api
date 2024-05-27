import { Module } from '@nestjs/common';
import { MailAdaptor } from './adaptors/builtin/mail/mail.adaptor';
import { RestAPIAdaptor } from './adaptors/builtin/restapi/restapi.adaptor';
import { RestApiController } from './adaptors/builtin/restapi/restapi.controller';
import { WebpageAdaptor } from './adaptors/builtin/web/webpage.adaptor';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { CallgentCreatedListener } from './listeners/callgent-created.listener';
import { CallgentsModule } from '../callgents/callgents.module';

@Module({
  imports: [CallgentsModule],
  providers: [
    { provide: 'EndpointsService', useClass: EndpointsService },
    CallgentCreatedListener,
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
  exports: ['EndpointsService'],
})
export class EndpointsModule {}
