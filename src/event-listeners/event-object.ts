import { EventCallbackType } from '@prisma/client';
import { Utils } from '../infra/libs/utils';

export class EventObject {
  constructor(
    /** src entity id which bind to the listener */
    public readonly srcId: string,
    public readonly eventType: string,
    public readonly dataType: string,
    /** target id to relate several events */
    public targetId: string,
    /** url template for response callback, `callgent:funName[@callgent]` to invoke callgent */
    public callback?: string,
    public readonly callbackType: EventCallbackType = 'EVENT',
  ) {
    this.id = Utils.uuid();
  }
  public readonly id: string;
  public statusCode = 1; // readonly, for response
  public readonly context: { [key: string]: any } = {};
  public message: string;
  public stopPropagation = false;
  public defaultPrevented = false;
}
