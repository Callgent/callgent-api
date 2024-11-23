import { Injectable } from '@nestjs/common';
import { CachedService } from '../../cached/cached.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeSepCtx } from '../invoke-sep.service';
import { SepProcessor } from './sep.processor';

/** resolve async response callback */
@Injectable()
export class SepCallbackProcessor extends SepProcessor {
  getName = (): string => 'InvokeCache';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async start(
    ctx: InvokeSepCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<PendingOrResponse> {
    this.clearSepCtx(reqEvent); // sep invocation finished
    this.next(ctx);

    const { statusCode, message, data } = ctx.response;
    if (statusCode == 2)
      throw new Error(
        `Must not callback with status code 2, msg=${message}, id=${reqEvent.id}`,
      );

    // if cache-able
    // if async, update cache, and inform callers
    await this.cachedService.updateCache(ctx.response as any, ctx, endpoint);
    return ctx.response as any;
  }
}
