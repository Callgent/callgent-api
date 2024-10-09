import { Module } from '@nestjs/common';
import { CallgentRealmsModule } from '../callgent-realms/callgent-realms.module';
import { EntriesModule } from '../entries/entries.module';
import { CallgentFunctionsController } from './callgent-functions.controller';
import { CallgentFunctionsService } from './callgent-functions.service';

@Module({
  imports: [EntriesModule, CallgentRealmsModule],
  providers: [
    { provide: 'CallgentFunctionsService', useClass: CallgentFunctionsService },
  ],
  controllers: [CallgentFunctionsController],
  exports: ['CallgentFunctionsService'],
})
export class CallgentFunctionsModule {}
