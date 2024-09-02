import { Global, Module } from '@nestjs/common';
import { EventStoresModule } from '../event-stores/event-stores.module';
import { EventListenersService } from './event-listeners.service';

@Global()
@Module({
  imports: [EventStoresModule],
  providers: [EventListenersService],
  exports: [EventListenersService],
})
export class EventListenersModule {}
