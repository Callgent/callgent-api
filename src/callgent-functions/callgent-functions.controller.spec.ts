import { Test, TestingModule } from '@nestjs/testing';
import { CallgentFunctionsController } from './callgent-functions.controller';

describe('CallgentFunctionsController', () => {
  let controller: CallgentFunctionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallgentFunctionsController],
    }).compile();

    controller = module.get<CallgentFunctionsController>(CallgentFunctionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
