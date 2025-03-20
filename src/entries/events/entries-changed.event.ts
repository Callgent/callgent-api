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
        whatFor?: string;
        how2Use?: string;
      };
      news?: (Omit<Entry, 'securities' | 'createdAt'> & { pk: bigint })[];
      olds?: (Omit<Entry, 'securities' | 'createdAt'> & { pk: bigint })[];
    },
  ) {}
}
