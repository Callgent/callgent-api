import { Module } from '@nestjs/common';
import { EntriesModule } from '../entries/entries.module';
import { InvokeService } from './invoke.service';

@Module({
  imports: [EntriesModule],
  providers: [{ provide: 'InvokeService', useClass: InvokeService }],
})
export class InvokeModule {}
