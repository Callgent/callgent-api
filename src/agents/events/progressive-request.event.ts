import { EventObject } from '../../event-listeners/event-object';

export class ProgressiveRequestEvent extends EventObject {
  constructor(
    srcId: string,
    /** parent event id in event chain */
    fromEvent: string,
    dataType: string,
    public readonly data: {
      /** url template for progressive requesting, `callgent:epName[@callgent]` to invoke callgent */
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
