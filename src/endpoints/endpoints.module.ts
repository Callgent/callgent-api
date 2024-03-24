import { Module } from '@nestjs/common';
import { RestAPIEndpoint } from './builtin/restapi/restapi.endpoint';
import { WebpageEndpoint } from './builtin/web/webpage.endpoint';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';

@Module({
  providers: [
    EndpointsService,
    {
      provide: 'restAPI-EndpointService',
      useClass: RestAPIEndpoint,
    },
    {
      provide: 'webpage-EndpointService',
      useClass: WebpageEndpoint,
    },
  ],
  controllers: [EndpointsController],
})
export class EndpointsModule {}
