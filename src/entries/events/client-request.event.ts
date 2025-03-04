import {
  EventObject,
  ServiceResponse,
} from '../../event-listeners/event-object';

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
    taskId: string,
    title: string,
    calledBy: string,
    context: {
      callgentId: string;
      callgentName: string;
      /** empty means anonymous */
      callerId?: string;
      /** requested endpoint name */
      epName?: string /** url template for progressive requesting, `callgent:epName[@callgent]` to invoke callgent */;
      /** empty to create new task */
      progressive?: string;
    },
    callback?: string,
  ) {
    super(
      entryId,
      'CLIENT_REQUEST',
      dataType,
      taskId,
      title,
      calledBy,
      callback,
      'URL',
    );
    Object.assign(this.context, context);
    this.context.req = req;
    this.context.invocations = {};

    Object.defineProperty(this, 'histories', {
      value: false,
      writable: true,
      enumerable: false,
    });
  }

  public declare readonly context: {
    req: any;
    /** event final response */
    resp?: ServiceResponse;
    callgentId: string;
    callgentName: string;
    callerId?: string;
    epName?: string;
    progressive?: string;
    invocations: {
      [id: string]: InvokeStatus;
    };
    [key: string]: any;
  };
  public declare histories?: ClientRequestEvent[];
}

export class InvokeStatus {
  readonly invokeId: string;
  readonly epName: string;
  readonly args: { [name: string]: any };
  /** callback response before postprocess */
  response?: any;
  processor?: {
    /** processor to run, empty means no processor to run */
    name: string;
    ctx?: any;
  };
  cacheKey?: string;
  cacheTtl?: number;
}
