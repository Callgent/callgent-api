import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeSepCtx } from '../invoke-sep.service';

/** processor chain for sep invoke */
export abstract class SepProcessor {
  abstract getName(): string;

  /** entry function */
  abstract start(
    ctx: InvokeSepCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }>;

  /** to next processor */
  next(ctx: InvokeSepCtx) {
    delete ctx.processor.fun;
  }

  /** end whole chain: !processor.name && !processor.fun */
  end(ctx: InvokeSepCtx) {
    ctx.stopPropagation = true;
    delete ctx.processor.fun;
    delete ctx.processor.name;
  }

  /**
   * invoking process. dispatch processorFun
   * @returns async, or final response as $.data
   */
  process(
    ctx: InvokeSepCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    const { processor } = ctx;
    const fun: Function = this[processor.fun];
    if (!fun)
      throw new Error(
        `Processor[${this.getName()}] function=${processor.fun} Not found, reqId=${reqEvent.id}`,
      );
    return fun.call(this, ctx, reqEvent, endpoint);
  }

  clearSepCtx(reqEvent: ClientRequestEvent) {
    delete reqEvent.context.invocation.sepInvoke;
  }
}
