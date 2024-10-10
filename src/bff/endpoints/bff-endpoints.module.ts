import { Module } from '@nestjs/common';
import { BffEndpointsController } from './bff-endpoints.controller';
import { EndpointsModule } from '../../endpoints/endpoints.module';

@Module({
  imports: [EndpointsModule],
  controllers: [BffEndpointsController],
})
export class BffEndpointsModule {}
