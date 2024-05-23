import { Test, TestingModule } from '@nestjs/testing';
import { EventListenersService } from './event-listeners.service';

describe('EventListenersService', () => {
  let service: EventListenersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventListenersService],
    }).compile();

    service = module.get<EventListenersService>(EventListenersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
