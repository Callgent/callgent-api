import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionsService } from './executions.service';

describe('ExecutionsService', () => {
  let service: ExecutionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExecutionsService],
    }).compile();

    service = module.get<ExecutionsService>(ExecutionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
