import { Injectable } from '@nestjs/common';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from '../invoke-chain.service';
import { InvokeProcessor } from './invoke.processor';
import { CachedService } from '../../cached/cached.service';

/** update response cache: resolved or not */
@Injectable()
export class InvokeCacheProcessor extends InvokeProcessor {
  getName = (): string => 'InvokeCache';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async start(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    this.next(ctx);
    // stop chain, only async goes to next via callback
    ctx.sepInvoke.stopPropagation = true;

    // invoke done, remove invocation ctx
    if (ctx.response.statusCode != 2) delete ctx.sepInvoke;
    // if cache-able
    await this.cachedService.toCache(ctx.response, ctx.sepInvoke, endpoint);
    return ctx.response;
  }
}
