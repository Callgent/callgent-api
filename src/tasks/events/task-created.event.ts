import { Prisma } from '@prisma/client';

export class TaskCreatedEvent {
  public static readonly eventName = 'task.created' as const;

  /**
   * @param task transient if task.id empty
   */
  constructor(
    public readonly task: Prisma.TaskUncheckedCreateInput,
  ) // public readonly receiver?: CallgentReceiver,
  {}
}
