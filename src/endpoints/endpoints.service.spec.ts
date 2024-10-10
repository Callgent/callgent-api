import { Test, TestingModule } from '@nestjs/testing';
import { EndpointsService } from './endpoints.service';

describe('EndpointsService', () => {
  let service: EndpointsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EndpointsService],
    }).compile();

    service = module.get<EndpointsService>(EndpointsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
