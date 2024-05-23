import { Test, TestingModule } from '@nestjs/testing';
import { EventStoresService } from './event-stores.service';

describe('EventStoresService', () => {
  let service: EventStoresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventStoresService],
    }).compile();

    service = module.get<EventStoresService>(EventStoresService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
