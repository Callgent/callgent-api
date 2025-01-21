import { Injectable } from '@nestjs/common';
import { CachedService } from '../../cached/cached.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';
import { SepProcessor } from './sep.processor';

/** update response cache: resolved or not */
@Injectable()
export class SepCacheProcessor extends SepProcessor {
  getName = (): string => 'InvokeCache';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
    preData: PendingOrResponse,
  ): Promise<PendingOrResponse> {
    // stop chain, only async goes to next via callback
    if (preData?.statusCode == 2) this.break(ctx);
    else this.end(ctx);

    // if cache-able
    await this.cachedService.toCache(ctx, preData, endpoint, reqEvent);
    return preData;
  }
}
