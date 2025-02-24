import { Test, TestingModule } from '@nestjs/testing';
import { CallgentHubService } from './callgent-hub.service';

describe('CallgentHubService', () => {
  let service: CallgentHubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CallgentHubService],
    }).compile();

    service = module.get<CallgentHubService>(CallgentHubService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
