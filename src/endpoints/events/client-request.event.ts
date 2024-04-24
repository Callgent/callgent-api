import { EventObject } from '../../event-listeners/event-object';

/** event from client endpoint */
export class ClientRequestEvent extends EventObject {
  constructor(
    // srcType: string,
    /** event src uuid, may be endpoint, task, action, lambda... */
    srcUuid: string,
    dataType: string,
    public readonly data: {
      /** taskId, or actionId if starts with '.' */
      ctxUuid?: string;
      /** empty means anonymous */
      caller?: string;
      /** raw request */
      req: unknown;
      /** requested botlet function name */
      funName?: string;
      /** url template for progressive requesting, `botlet:funName[@botlet]` to invoke botlet */
      progressive?: string;
      /** url template for response callback, `botlet:funName[@botlet]` to invoke botlet */
      callback?: string;
    },
  ) {
    super(srcUuid, 'CLIENT_REQUEST', dataType);
  }
}
