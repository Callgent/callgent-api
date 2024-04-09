import { Test, TestingModule } from '@nestjs/testing';
import { TaskActionsService } from './task-actions.service';

describe('TaskActionsService', () => {
  let service: TaskActionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaskActionsService],
    }).compile();

    service = module.get<TaskActionsService>(TaskActionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
