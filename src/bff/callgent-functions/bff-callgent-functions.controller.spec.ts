import { Test, TestingModule } from '@nestjs/testing';
import { BffCallgentFunctionsController } from './bff-callgent-functions.controller';

describe('BffCallgentFunctionsController', () => {
  let controller: BffCallgentFunctionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BffCallgentFunctionsController],
    }).compile();

    controller = module.get<BffCallgentFunctionsController>(BffCallgentFunctionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
