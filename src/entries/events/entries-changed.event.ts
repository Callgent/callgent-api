import { Entry } from '../entities/entry.entity';

/** event of entries content change, securities excluded */
export class EntriesChangedEvent {
  public static readonly eventName = 'entries.changed' as const;

  constructor(
    public readonly data: {
      opBy: string;
      callgent: {
        id: string;
        name?: string;
        summary?: string;
        instruction?: string;
      };
      news?: (Omit<Entry, 'securities' | 'createdAt'> & { pk: number })[];
      olds?: (Omit<Entry, 'securities' | 'createdAt'> & { pk: number })[];
    },
  ) {}
}
