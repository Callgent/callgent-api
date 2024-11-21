import { Injectable } from '@nestjs/common';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from '../invoke-chain.service';
import { InvokeProcessor } from './invoke.processor';
import { CachedService } from '../../cached/cached.service';

/** resolve async response callback */
@Injectable()
export class InvokeCallbackProcessor extends InvokeProcessor {
  getName = (): string => 'InvokeCache';
  constructor(private readonly cachedService: CachedService) {
    super();
  }

  async start(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    delete ctx.sepInvoke; // sep invocation finished
    this.next(ctx);

    const { data, statusCode, message } = ctx.response;
    if (statusCode == 2)
      throw new Error(
        `Must not callback with status code 2, msg=${message}, id=${reqEvent.id}`,
      );

    // if cache-able
    // if async, update cache, and inform callers
    await this.cachedService.updateCache(ctx.response, ctx.sepInvoke, endpoint);
    return ctx.response;
  }
}
