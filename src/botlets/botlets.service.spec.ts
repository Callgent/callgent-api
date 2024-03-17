import { Test, TestingModule } from '@nestjs/testing';
import { BotletsService } from './botlets.service';

describe('BotletsService', () => {
  let service: BotletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BotletsService],
    }).compile();

    service = module.get<BotletsService>(BotletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
