import { Callgent } from '@prisma/client';

export class CallgentCreatedEvent {
  public static readonly eventName = 'callgent.created' as const;

  constructor(public readonly callgent: Callgent) {}
}
