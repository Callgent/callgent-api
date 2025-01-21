import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';

/** processor chain for sep invoke */
export abstract class SepProcessor {
  abstract getName(): string;

  /** entry function */
  async process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
    nextProcessor: string,
    preData: PendingOrResponse,
  ): Promise<{
    data: PendingOrResponse;
    stop: boolean;
  }> {
    const data = await this._process(ctx, reqEvent, endpoint, preData);

    const breakCurrent = (ctx.processor as any).breakCurrent;
    if (!breakCurrent && ctx.processor.name) ctx.processor.name = nextProcessor;
    delete (ctx.processor as any).breakCurrent;

    const stop = !ctx.processor.name || typeof breakCurrent === 'boolean';
    return { data, stop };
  }

  protected abstract _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
    preData: PendingOrResponse,
  ): Promise<PendingOrResponse>;

  /** break chain, next time starts from current or next */
  protected break(ctx: InvokeStatus, current?: boolean) {
    (ctx.processor as any).breakCurrent = !!current;
  }

  /** end whole chain */
  protected end(ctx: InvokeStatus) {
    delete ctx.processor.name;
  }
}
