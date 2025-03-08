import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeService } from '../invoke.service';

export abstract class AbstractTxListener {
  constructor(protected readonly invokeService: InvokeService) {}

  protected getTxId(reqEvent: ClientRequestEvent) {
    const invokeId = this.invokeService.getInvokeId();
    // CEN has no invocation ctx, so reqEvent.id as txId
    const ctx = reqEvent.context.invocations?.[invokeId];
    // FIXME ctx.epId
    return [reqEvent.id, ctx?.epName, invokeId].filter((s) => s).join(':');
  }
}
