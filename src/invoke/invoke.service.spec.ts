import { Test, TestingModule } from '@nestjs/testing';
import { InvokeService } from './invoke.service';

describe('InvokeService', () => {
  let service: InvokeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvokeService],
    }).compile();

    service = module.get<InvokeService>(InvokeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
