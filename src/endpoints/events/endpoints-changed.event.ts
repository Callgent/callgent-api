import { Endpoint } from '../entities/endpoint.entity';

/** event of endpoints content change, securities excluded */
export class EndpointsChangedEvent {
  public static readonly eventName = 'endpoints.changed' as const;

  constructor(
    public readonly data: {
      opBy: string;
      entry: {
        id: string;
        summary?: string;
        instruction?: string;
        callgentId?: string;
      };
      news?: Omit<Endpoint, 'securities' | 'createdAt'>[];
      olds?: Omit<Endpoint, 'securities' | 'createdAt'>[];
    },
  ) {}
}
