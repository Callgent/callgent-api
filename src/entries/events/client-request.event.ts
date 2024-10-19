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
    entryId: string,
    dataType: string,
    req: object,
    public readonly data: {
      callgentId: string;
      callgentName: string;
      /** empty means anonymous */
      callerId?: string;
      /** requested endpoint name */
      epName?: string /** url template for progressive requesting, `callgent:epName[@callgent]` to invoke callgent */;
      /** empty to create new task */
      taskId?: string;
      progressive?: string;
    },
    callback?: string,
  ) {
    super(entryId, 'CLIENT_REQUEST', dataType, taskId, callback, 'URL');
    this.context.req = req;
  }
}
