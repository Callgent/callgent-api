import { Botlet } from '@prisma/client';

export class BotletCreatedEvent {
  public static readonly eventName = 'botlet.created';

  constructor(public readonly botlet: Botlet) {}
}
