import { Test, TestingModule } from '@nestjs/testing';
import { CallgentsController } from './callgents.controller';

describe('CallgentsController', () => {
  let controller: CallgentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallgentsController],
    }).compile();

    controller = module.get<CallgentsController>(CallgentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
