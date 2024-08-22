import { Test, TestingModule } from '@nestjs/testing';
import { CallgentTreeController } from './callgent-tree.controller';

describe('CallgentTreeController', () => {
  let controller: CallgentTreeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallgentTreeController],
    }).compile();

    controller = module.get<CallgentTreeController>(CallgentTreeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
