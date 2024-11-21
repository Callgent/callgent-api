import { Injectable } from '@nestjs/common';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from '../invoke-chain.service';
import { InvokeProcessor } from './invoke.processor';
import { CachedService } from '../../cached/cached.service';

/** get from cached */
@Injectable()
export class InvokeCachedProcessor extends InvokeProcessor {
  getName = (): string => 'InvokeCached';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async start(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    // get from cached
    const { cacheKey, cacheTtl, response } =
      await this.cachedService.fromCached(endpoint, reqEvent);
    cacheKey && Object.assign(ctx.sepInvoke, { cacheKey, cacheTtl });

    if (response) {
      this.end(ctx); // end whole chain
    } else this.next(ctx);

    return response;
  }
}
