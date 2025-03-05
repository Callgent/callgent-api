import { Entry } from '../entities/entry.entity';

export class EntryCreatedEvent {
  public static readonly eventName = 'entries.created' as const;

  constructor(public readonly entry: Entry) {}
}
