import { Inject, Injectable } from '@nestjs/common';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../entries/events/client-request.event';
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
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    if (!ctx) throw new Error('[sepInvoke] ctx not found, id=' + reqEvent.id);
    if (!ctx.epName) return; // no specific ep, just return

    // for each chained, process and edit event, may return async,
    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    const endpoint = endpoints.find((e) => e.name == ctx.epName);

    let switchProcessor = false,
      result: { statusCode: 2; message: string } | { data: any } = null;
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
      result = { data: reqEvent.context.resp };
      delete reqEvent.context.sepInvoke;
    }

    return result;
  }
}

export class InvokeSepCtx {
  readonly epName: string;
  readonly args: any;
  /** sep response */
  response?: any;
  /** stop chain execution */
  stopPropagation?: true;
  /** if(!processor) chain start; elif(!name && !fun) end chain */
  processor?: { name: string; fun: string; ctx?: any };
  cacheKey?: string;
  cacheTtl?: number;
}
