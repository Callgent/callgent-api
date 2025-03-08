import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ServiceResponse } from '../../event-listeners/event-object';

/** emit after sep postprocess */
export class PostResponseEvent {
  public static readonly eventName = 'response.post' as const;

  constructor(
    public readonly response: ServiceResponse,
    public readonly reqEvent: ClientRequestEvent,
  ) {}
}
