import { Callgent } from '@prisma/client';

export class CallgentDeletedEvent {
  public static readonly eventName = 'callgent.deleted' as const;

  constructor(public readonly callgent: Callgent) {}
}
