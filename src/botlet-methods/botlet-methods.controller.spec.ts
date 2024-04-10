import { Test, TestingModule } from '@nestjs/testing';
import { BotletMethodsController } from './botlet-methods.controller';

describe('BotletMethodsController', () => {
  let controller: BotletMethodsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotletMethodsController],
    }).compile();

    controller = module.get<BotletMethodsController>(BotletMethodsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
