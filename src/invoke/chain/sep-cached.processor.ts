import { Injectable } from '@nestjs/common';
import { CachedService } from '../../cached/cached.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';
import { SepProcessor } from './sep.processor';

/** get from cached */
@Injectable()
export class SepCachedProcessor extends SepProcessor {
  getName = (): string => 'InvokeCached';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  protected async _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<PendingOrResponse> {
    // get from cached
    const { cacheKey, cacheTtl, response } =
      await this.cachedService.fromCached(ctx.invokeId, endpoint, reqEvent);
    cacheKey && Object.assign(ctx, { cacheKey, cacheTtl });

    // end whole chain, even pending response
    if (response) this.end(ctx);

    return response;
  }
}
