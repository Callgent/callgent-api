import { Module } from '@nestjs/common';
import { CallgentsModule } from '../callgents/callgents.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { CallgentTreeController } from './callgent-tree.controller';

@Module({
  imports: [CallgentsModule, EndpointsModule],
  controllers: [CallgentTreeController],
})
export class CallgentTreeModule {}
