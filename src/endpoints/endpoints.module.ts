import { Module } from '@nestjs/common';
import { CallgentsModule } from '../callgents/callgents.module';
import { EmailAdaptor } from './adaptors/builtin/email/email.adaptor';
import { RestAPIAdaptor } from './adaptors/builtin/restapi/restapi.adaptor';
import { RestApiController } from './adaptors/builtin/restapi/restapi.controller';
import { WebpageAdaptor } from './adaptors/builtin/web/webpage.adaptor';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';
import { CallgentCreatedListener } from './listeners/callgent-created.listener';

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
      provide: 'Webpage-EndpointAdaptor',
      useClass: WebpageAdaptor,
    },
    {
      provide: 'Email-EndpointAdaptor',
      useClass: EmailAdaptor,
    },
  ],
  controllers: [EndpointsController, RestApiController],
  exports: ['EndpointsService'],
})
export class EndpointsModule {}
