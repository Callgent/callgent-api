import { Test, TestingModule } from '@nestjs/testing';
import { EventStoresController } from './event-stores.controller';

describe('EventStoresController', () => {
  let controller: EventStoresController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventStoresController],
    }).compile();

    controller = module.get<EventStoresController>(EventStoresController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
