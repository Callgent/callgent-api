import { Test, TestingModule } from '@nestjs/testing';
import { BotletFunctionsService } from './botlet-functions.service';

describe('BotletFunctionsService', () => {
  let service: BotletFunctionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BotletFunctionsService],
    }).compile();

    service = module.get<BotletFunctionsService>(BotletFunctionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
