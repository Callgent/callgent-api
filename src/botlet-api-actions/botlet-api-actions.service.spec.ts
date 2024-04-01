import { Test, TestingModule } from '@nestjs/testing';
import { BotletApiActionsService } from './botlet-api-actions.service';

describe('BotletApiActionsService', () => {
  let service: BotletApiActionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BotletApiActionsService],
    }).compile();

    service = module.get<BotletApiActionsService>(BotletApiActionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
