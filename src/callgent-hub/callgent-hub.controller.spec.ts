import { Test, TestingModule } from '@nestjs/testing';
import { CallgentHubController } from './callgent-hub.controller';

describe('CallgentHubController', () => {
  let controller: CallgentHubController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallgentHubController],
    }).compile();

    controller = module.get<CallgentHubController>(CallgentHubController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
