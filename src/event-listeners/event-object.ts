import { JsonValue } from '@prisma/client/runtime/library';
import { Utils } from '../infra/libs/utils';

export class EventObject {
  constructor(
    /** src entity uuid which bind to the listener */
    public readonly srcId: string,
    public readonly eventType: string,
    public readonly dataType: string,
    /** target uuid to relate several events */
    public targetId: string,
    /** parent event uuid of emitting chain */
    public readonly parentId?: string,
  ) {
    this.uuid = Utils.uuid();
  }
  public readonly uuid: string;
  public statusCode = -1; // for response only
  public readonly context: { [key: string]: JsonValue } = {};
  public message: string;
  public stopPropagation = false;
  public defaultPrevented = false;
}
