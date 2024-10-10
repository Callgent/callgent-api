import { Module } from '@nestjs/common';
import { EndpointsModule } from '../../endpoints/endpoints.module';
import { CallgentRealmsModule } from '../../callgent-realms/callgent-realms.module';
import { CallgentsModule } from '../../callgents/callgents.module';
import { EntriesModule } from '../../entries/entries.module';
import { CallgentTreeController } from './callgent-tree.controller';

@Module({
  imports: [
    CallgentsModule,
    EntriesModule,
    EndpointsModule,
    CallgentRealmsModule,
  ],
  controllers: [CallgentTreeController],
})
export class CallgentTreeModule {}
