import { Prisma } from '@prisma/client';

export class ProgressiveRequestEvent {
  public static readonly eventName = 'request.progressive' as const;

  /**
   * @param task transient if task.uuid empty
   */
  constructor(public readonly task: Prisma.TaskUncheckedCreateInput) {}
}
