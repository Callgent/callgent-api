import { Test, TestingModule } from '@nestjs/testing';
import { CachedService } from './cached.service';

describe('CachedService', () => {
  let service: CachedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CachedService],
    }).compile();

    service = module.get<CachedService>(CachedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
