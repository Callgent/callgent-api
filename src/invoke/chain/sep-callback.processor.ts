import { Injectable } from '@nestjs/common';
import { CachedService } from '../../cached/cached.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';
import { SepProcessor } from './sep.processor';

/** update cache on callback */
@Injectable()
export class SepCallbackCacheProcessor extends SepProcessor {
  getName = (): string => 'InvokeCallback';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
    preData: PendingOrResponse,
  ): Promise<PendingOrResponse> {
    // if cache-able
    // if async, update cache, and inform callers
    await this.cachedService.updateCache(preData, ctx, endpoint);
    return preData;
  }
}
