import { JsonValue } from '@prisma/client/runtime/library';
import { EventObject } from '../../event-listeners/event-object';

/**
 * event from client endpoint, processing:
 * 1. adaptor preprocessing
 * 2. create task action
 * 3. function mapping
 * 4. args mapping
 * 5. invocation
 */
export class ClientRequestEvent extends EventObject {
  constructor(
    /** client endpoint uuid */
    cepId: string,
    /** empty to create new task */
    taskId: string,
    dataType: string,
    /** raw request, will not be persisted */
    public readonly rawReq: any,
    callback: string,
    public readonly data: {
      botletId: string;
      botletName: string;
      /** empty means anonymous */
      caller?: string;
      req?: JsonValue;
      /** requested botlet function name */
      funName?: string;
      /** url template for progressive requesting, `botlet:funName[@botlet]` to invoke botlet */
      progressive?: string;
    },
  ) {
    super(cepId, 'CLIENT_REQUEST', dataType, taskId, callback, 'URL');
  }
}
