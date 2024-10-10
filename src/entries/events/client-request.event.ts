import { EventObject } from '../../event-listeners/event-object';

/**
 * event from client entry, processing:
 * 1. adaptor preprocessing
 * 2. create task action
 * 3. function mapping
 * 4. args mapping
 * 5. invocation
 */
export class ClientRequestEvent extends EventObject {
  constructor(
    /** client entry id */
    cepId: string,
    /** empty to create new task */
    taskId: string,
    dataType: string,
    callback: string,
    req: object,
    public readonly data: {
      callgentId: string;
      callgentName: string;
      /** empty means anonymous */
      callerId?: string;
      /** requested endpoint name */
      funName?: string;
      /** url template for progressive requesting, `callgent:funName[@callgent]` to invoke callgent */
      progressive?: string;
    },
  ) {
    super(cepId, 'CLIENT_REQUEST', dataType, taskId, callback, 'URL');
    this.context.req = req;
  }
}
