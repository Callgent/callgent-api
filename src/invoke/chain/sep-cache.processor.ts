import { Injectable } from '@nestjs/common';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeSepCtx } from '../invoke-sep.service';
import { SepProcessor } from './sep.processor';
import { CachedService } from '../../cached/cached.service';

/** update response cache: resolved or not */
@Injectable()
export class SepCacheProcessor extends SepProcessor {
  getName = (): string => 'InvokeCache';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async start(
    ctx: InvokeSepCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    this.next(ctx);
    // stop chain, only async goes to next via callback
    ctx.stopPropagation = true;

    // invoke done, remove invocation ctx
    if (ctx.response.statusCode != 2) this.clearSepCtx(reqEvent);
    // if cache-able
    await this.cachedService.toCache(ctx.response, ctx, endpoint);
    return ctx.response;
  }
}
