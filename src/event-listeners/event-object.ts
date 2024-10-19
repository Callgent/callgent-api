import { EventCallbackType } from '@prisma/client';
import { Utils } from '../infra/libs/utils';

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
  }
  public readonly id: string;
  public readonly context: { [key: string]: any } = {};
  public stopPropagation = false;
  public preventDefault = false;
}
