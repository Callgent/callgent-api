import { Inject, Injectable } from '@nestjs/common';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../entries/adaptors/entry-adaptor.base';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { RestApiResponse } from '../restapi/response.interface';
import { SepProcessor } from './chain/sep.processor';

export const INVOKE_CHAIN_LIST = Symbol('INVOKE_CHAIN_LIST');

/** sep invoke chain: auth, cache, adaptor.invoke, adaptor.postprocess,  */
@Injectable()
export class InvokeSepService {
  constructor(
    @Inject(INVOKE_CHAIN_LIST)
    private readonly processors: SepProcessor[],
  ) {}

  async chain(
    ctx: InvokeSepCtx,
    reqEvent: ClientRequestEvent,
  ): Promise<PendingOrResponse> {
    if (!ctx) return; // skip sep invoke
    if (!ctx.epName)
      throw new Error('[sepInvoke] epName not specified, id=' + reqEvent.id);

    // for each chained, process and edit event, may return async,
    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    const endpoint = endpoints.find((e) => e.name == ctx.epName);

    let switchProcessor = false,
      result: PendingOrResponse = null;
    if (!ctx.processor || ctx.processor.fun || ctx.processor.name) {
      switchProcessor = !ctx.processor; // first
      for (let i = 0; i < this.processors.length; i++) {
        const p = this.processors[i];
        if (switchProcessor) {
          switchProcessor = false;
          ctx.processor = { name: p.getName(), fun: 'start' };
        } else if (p.getName() != ctx.processor.name) continue;

        // invoke processor
        result =
          ctx.processor.fun && (await p.process(ctx, reqEvent, endpoint));

        if (ctx.stopPropagation) {
          delete ctx.stopPropagation;
          break;
        }
        if ((result as any)?.statusCode == 2) return result;
        if (!ctx.processor.fun) switchProcessor = true;
      }
    } else {
      // skip all processors, sep invoke done, @see processor.end()
      result = ctx.response as any;
      delete reqEvent.context.sepInvoke;
    }

    return result;
  }
}

export class InvokeSepCtx {
  readonly epName: string;
  readonly args: { [name: string]: any };
  /** sep response */
  response?: { data?: any; statusCode?: 2; message?: string };
  /** stop chain execution */
  stopPropagation?: true;
  /** if(!processor) chain start; elif(!name && !fun) end chain */
  processor?: { name: string; fun: string; ctx?: any };
  cacheKey?: string;
  cacheTtl?: number;
}
