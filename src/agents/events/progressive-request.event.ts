import { EventObject } from '../../event-listeners/event-object';

export class ProgressiveRequestEvent extends EventObject {
  constructor(
    srcId: string,
    /** parent event uuid in event chain */
    fromEvent: string,
    dataType: string,
    public readonly data: {
      /** url template for progressive requesting, `botlet:funName[@botlet]` to invoke botlet */
      progressive: string;
    },
  ) {
    super(
      srcId,
      'PROGRESSIVE_REQUEST',
      dataType,
      undefined,
      fromEvent,
      'EVENT',
    );
  }
}
