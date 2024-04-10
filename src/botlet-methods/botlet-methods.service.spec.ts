import { Test, TestingModule } from '@nestjs/testing';
import { BotletMethodsService } from './botlet-methods.service';

describe('BotletMethodsService', () => {
  let service: BotletMethodsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BotletMethodsService],
    }).compile();

    service = module.get<BotletMethodsService>(BotletMethodsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
