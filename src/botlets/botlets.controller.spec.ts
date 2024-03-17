import { Test, TestingModule } from '@nestjs/testing';
import { BotletsController } from './botlets.controller';

describe('BotletsController', () => {
  let controller: BotletsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotletsController],
    }).compile();

    controller = module.get<BotletsController>(BotletsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
