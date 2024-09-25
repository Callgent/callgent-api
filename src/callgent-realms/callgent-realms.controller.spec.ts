import { Test, TestingModule } from '@nestjs/testing';
import { CallgentRealmsController } from './callgent-realms.controller';

describe('CallgentRealmsController', () => {
  let controller: CallgentRealmsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallgentRealmsController],
    }).compile();

    controller = module.get<CallgentRealmsController>(CallgentRealmsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
