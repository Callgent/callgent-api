import { Injectable } from '@nestjs/common';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from './invoke-chain.service';
import { InvokeProcessor } from './invoke.processor';
import { CachedService } from '../../cached/cached.service';

/** update response cache */
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
    await this.cachedService.toCache(endpoint, reqEvent);
    delete ctx.sepInvoke.processor.fun; // to next
    return;
  }
}
