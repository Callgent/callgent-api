import { Module } from '@nestjs/common';
import { WebpageEndpoint } from './builtin/webpage/webpage.endpoint';
import { EndpointsController } from './endpoints.controller';
import { EndpointsService } from './endpoints.service';

@Module({
  providers: [
    EndpointsService,
    {
      provide: 'webpage-EndpointService',
      useClass: WebpageEndpoint,
    },
  ],
  controllers: [EndpointsController],
})
export class EndpointsModule {}
