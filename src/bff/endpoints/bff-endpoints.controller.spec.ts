import { Test, TestingModule } from '@nestjs/testing';
import { BffEndpointsController } from './bff-endpoints.controller';

describe('BffEndpointsController', () => {
  let controller: BffEndpointsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BffEndpointsController],
    }).compile();

    controller = module.get<BffEndpointsController>(BffEndpointsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
