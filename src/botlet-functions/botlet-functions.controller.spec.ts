import { Test, TestingModule } from '@nestjs/testing';
import { BotletFunctionsController } from './botlet-functions.controller';

describe('BotletFunctionsController', () => {
  let controller: BotletFunctionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotletFunctionsController],
    }).compile();

    controller = module.get<BotletFunctionsController>(BotletFunctionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
