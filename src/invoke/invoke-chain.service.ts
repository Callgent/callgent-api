import { Inject, Injectable } from '@nestjs/common';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { InvokeProcessor } from './chain/invoke.processor';

export const INVOKE_CHAIN_LIST = Symbol('INVOKE_CHAIN_LIST');

/** sep invoke chain: auth, cache, adaptor.invoke, adaptor.postprocess,  */
@Injectable()
export class InvokeChainService {
  constructor(
    @Inject(INVOKE_CHAIN_LIST)
    private readonly processors: InvokeProcessor[],
  ) {}

  async run(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    // no specific ep, just return
    if (!ctx.sepInvoke) return;

    // for each chained, process and edit event, may return async,

    const sepInvoke = ctx.sepInvoke;
    if (!sepInvoke.epName)
      throw new Error('[sepInvoke] epName must not empty, id=' + reqEvent.id);
    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    const endpoint = endpoints.find((e) => e.name == sepInvoke.epName);

    let switchProcessor = false,
      result: { statusCode: 2; message: string } | { data: any } = null;
    if (
      !sepInvoke.processor ||
      sepInvoke.processor.fun ||
      sepInvoke.processor.name
    ) {
      switchProcessor = !sepInvoke.processor; // first
      for (let i = 0; i < this.processors.length; i++) {
        const p = this.processors[i];
        if (switchProcessor) {
          switchProcessor = false;
          sepInvoke.processor = { name: p.getName(), fun: 'start' };
        } else if (p.getName() != sepInvoke.processor.name) continue;

        // invoke processor
        result =
          sepInvoke.processor.fun && (await p.process(ctx, reqEvent, endpoint));

        if (sepInvoke.stopPropagation) {
          delete sepInvoke.stopPropagation;
          break;
        }
        if ((result as any)?.statusCode == 2) return result;
        if (!sepInvoke.processor.fun) switchProcessor = true;
      }
    } else {
      // skip all processors, sep invoke done, @see processor.end()
      result = { data: reqEvent.context.resp };
      delete reqEvent.context.sepInvoke;
    }

    return result;
  }
}

export class ChainCtx {
  /** macro member function name */
  readonly callbackName: string;
  response: any;
  sepInvoke: {
    readonly epName: string;
    readonly args: any;
    /** stop chain execution */
    stopPropagation?: true;
    /** if(!processor) chain start; elif(!name && !fun) end chain */
    processor?: { name: string; fun: string; ctx?: any };
    cacheKey?: string;
    cacheTtl?: number;
  };
}
