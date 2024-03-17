import { Test, TestingModule } from '@nestjs/testing';
import { CallerController } from './caller.controller';

describe('CallerController', () => {
  let controller: CallerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallerController],
    }).compile();

    controller = module.get<CallerController>(CallerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
