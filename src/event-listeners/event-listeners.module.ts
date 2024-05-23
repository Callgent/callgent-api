import { Global, Module } from '@nestjs/common';
import { EventListenersService } from './event-listeners.service';

@Global()
@Module({
  providers: [EventListenersService],
  exports: [EventListenersService],
})
export class EventListenersModule {}
