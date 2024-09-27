import { Module } from '@nestjs/common';
import { CallgentFunctionsModule } from '../../callgent-functions/callgent-functions.module';
import { CallgentRealmsModule } from '../../callgent-realms/callgent-realms.module';
import { CallgentsModule } from '../../callgents/callgents.module';
import { EndpointsModule } from '../../endpoints/endpoints.module';
import { CallgentTreeController } from './callgent-tree.controller';

@Module({
  imports: [
    CallgentsModule,
    EndpointsModule,
    CallgentFunctionsModule,
    CallgentRealmsModule,
  ],
  controllers: [CallgentTreeController],
})
export class CallgentTreeModule {}
