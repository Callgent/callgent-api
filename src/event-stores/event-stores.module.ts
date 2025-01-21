import { Module } from '@nestjs/common';
import { InvokeModule } from '../invoke/invoke.module';
import { EventStoresService } from './event-stores.service';

@Module({
  imports: [InvokeModule],
  providers: [{ provide: 'EventStoresService', useClass: EventStoresService }],
  exports: ['EventStoresService'],
})
export class EventStoresModule {}
