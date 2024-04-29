import { Module } from '@nestjs/common';
import { EventStoresService } from './event-stores.service';

@Module({
  providers: [{ provide: 'EventStoresService', useClass: EventStoresService }],
  exports: ['EventStoresService'],
})
export class EventStoresModule {}
