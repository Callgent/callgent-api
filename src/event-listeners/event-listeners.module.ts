import { Global, Module } from '@nestjs/common';
import { EventStoresModule } from '../event-stores/event-stores.module';
import { InvokeModule } from '../invoke/invoke.module';
import { EventListenersService } from './event-listeners.service';

@Global()
@Module({
  imports: [EventStoresModule, InvokeModule],
  providers: [EventListenersService],
  exports: [EventListenersService],
})
export class EventListenersModule {}
