import { Module } from '@nestjs/common';
import { CallgentFunctionsModule } from '../../callgent-functions/callgent-functions.module';
import { CallgentRealmsModule } from '../../callgent-realms/callgent-realms.module';
import { CallgentsModule } from '../../callgents/callgents.module';
import { EntriesModule } from '../../entries/entries.module';
import { CallgentTreeController } from './callgent-tree.controller';

@Module({
  imports: [
    CallgentsModule,
    EntriesModule,
    CallgentFunctionsModule,
    CallgentRealmsModule,
  ],
  controllers: [CallgentTreeController],
})
export class CallgentTreeModule {}
