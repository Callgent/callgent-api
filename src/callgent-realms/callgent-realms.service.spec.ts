import { Test, TestingModule } from '@nestjs/testing';
import { CallgentRealmsService } from './callgent-realms.service';

describe('CallgentRealmsService', () => {
  let service: CallgentRealmsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CallgentRealmsService],
    }).compile();

    service = module.get<CallgentRealmsService>(CallgentRealmsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
