import { Test, TestingModule } from '@nestjs/testing';
import { BotletApiActionsController } from './botlet-api-actions.controller';

describe('BotletApiActionsController', () => {
  let controller: BotletApiActionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BotletApiActionsController],
    }).compile();

    controller = module.get<BotletApiActionsController>(BotletApiActionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
