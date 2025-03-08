import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { CallgentRealm } from '../entities/callgent-realm.entity';

/** emit after (cen/sep) auth ok/or attached to req for the realm */
export class PostAuthEvent {
  public static readonly eventName = 'auth.post' as const;

  constructor(
    public readonly realm: CallgentRealm,
    public readonly reqEvent: ClientRequestEvent,
  ) {}
}
