import { Test, TestingModule } from '@nestjs/testing';
import { CallgentsService } from './callgents.service';

describe('CallgentsService', () => {
  let service: CallgentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CallgentsService],
    }).compile();

    service = module.get<CallgentsService>(CallgentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
