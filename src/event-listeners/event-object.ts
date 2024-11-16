import { EventCallbackType } from '@prisma/client';
import { Utils } from '../infras/libs/utils';

export class EventObject {
  constructor(
    /** src entity id which bind to the listener */
    public readonly srcId: string,
    public readonly eventType: string,
    public readonly dataType: string,
    /** task id to relate several events */
    public taskId: string,
    /** url template for response callback, `callgent:epName[@callgent]` to invoke callgent */
    public callback?: string,
    public readonly callbackType: EventCallbackType = 'EVENT',
  ) {
    this.id = Utils.uuid();

    Object.defineProperty(this, 'context', {
      value: {},
      enumerable: false,
    });
    Object.defineProperty(this, 'stopPropagation', {
      value: false,
      writable: true,
      enumerable: false,
    });
  }
  public readonly id: string;
  public declare readonly context: { [key: string]: any };
  /** if true, the event will not be propagated to other listeners */
  public declare stopPropagation: boolean;
}
