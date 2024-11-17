import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from './invoke-chain.service';

export abstract class InvokeProcessor {
  abstract getName(): string;

  /** entry function */
  abstract start(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }>;

  /**
   * invoking process. dispatch processorFun
   * @returns async, or final response as $.data
   */
  process(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    const { processor } = ctx.sepInvoke;
    const fun: Function = this[processor.fun];
    if (!fun)
      throw new Error(
        `Processor[${this.getName()}] function=${processor.fun} Not found, reqId=${reqEvent.id}`,
      );
    return fun.call(this, ctx, reqEvent, endpoint);
  }
}
