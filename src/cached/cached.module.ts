import { Module } from '@nestjs/common';
import { EntriesModule } from '../entries/entries.module';
import { CachedService } from './cached.service';

@Module({
  imports: [EntriesModule],
  providers: [CachedService],
  exports: [CachedService],
})
export class CachedModule {}
