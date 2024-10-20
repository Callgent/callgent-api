import { Entry } from '../entities/entry.entity';

/** event of entries content change, securities excluded */
export class EntriesChangedEvent {
  public static readonly eventName = 'entries.changed' as const;

  constructor(
    public readonly data: {
      callgent: { id: string; summary?: string; instruction?: string };
      news?: Omit<Entry, 'securities' | 'createdAt'>[];
      olds?: Omit<Entry, 'securities' | 'createdAt'>[];
    },
  ) {}
}
