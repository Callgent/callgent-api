import { BotletReceiver, Prisma } from '@prisma/client';

export class TaskCreatedEvent {
  public static readonly eventName = 'task.created';

  /**
   * @param task transient if task.uuid empty
   */
  constructor(
    public readonly task: Prisma.TaskUncheckedCreateInput,
    public readonly receiver?: BotletReceiver,
  ) {}
}
