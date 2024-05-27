import { Test, TestingModule } from '@nestjs/testing';
import { CallgentFunctionsService } from './callgent-functions.service';

describe('CallgentFunctionsService', () => {
  let service: CallgentFunctionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CallgentFunctionsService],
    }).compile();

    service = module.get<CallgentFunctionsService>(CallgentFunctionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
