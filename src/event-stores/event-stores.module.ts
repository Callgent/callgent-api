import { Module } from '@nestjs/common';
import { InvokeModule } from '../invoke/invoke.module';
import { EventStoresService } from './event-stores.service';
import { EventStoresController } from './event-stores.controller';

@Module({
  imports: [InvokeModule],
  providers: [{ provide: 'EventStoresService', useClass: EventStoresService }],
  exports: ['EventStoresService'],
  controllers: [EventStoresController],
})
export class EventStoresModule {}
