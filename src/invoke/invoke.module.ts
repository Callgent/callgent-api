import { Module } from '@nestjs/common';
import { EntriesModule } from '../entries/entries.module';
import { InvokeChainService } from './invoke-chain.service';
import { InvokeService } from './invoke.service';

@Module({
  imports: [EntriesModule],
  providers: [
    { provide: 'InvokeService', useClass: InvokeService },
    InvokeChainService,
  ],
})
export class InvokeModule {}
