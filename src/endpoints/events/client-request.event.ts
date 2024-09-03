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
    /** client endpoint id */
    cepId: string,
    /** empty to create new task */
    taskId: string,
    dataType: string,
    /** raw request, temp prop, will not be persisted */
    public rawReq: any,
    callback: string,
    public readonly data: {
      callgentId: string;
      callgentName: string;
      /** empty means anonymous */
      caller?: string;
      req?: JsonValue;
      resp?: JsonValue;
      /** requested callgent function name */
      funName?: string;
      /** url template for progressive requesting, `callgent:funName[@callgent]` to invoke callgent */
      progressive?: string;
    },
  ) {
    super(cepId, 'CLIENT_REQUEST', dataType, taskId, callback, 'URL');
  }
}
