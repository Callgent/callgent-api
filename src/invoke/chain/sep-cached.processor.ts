import { Injectable } from '@nestjs/common';
import { CachedService } from '../../cached/cached.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeSepCtx } from '../invoke-sep.service';
import { SepProcessor } from './sep.processor';

/** get from cached */
@Injectable()
export class SepCachedProcessor extends SepProcessor {
  getName = (): string => 'InvokeCached';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async start(
    ctx: InvokeSepCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    // get from cached
    const { cacheKey, cacheTtl, response } =
      await this.cachedService.fromCached(endpoint, reqEvent);
    cacheKey && Object.assign(ctx, { cacheKey, cacheTtl });

    if (response) {
      this.end(ctx); // end whole chain
    } else this.next(ctx);

    return response;
  }
}
