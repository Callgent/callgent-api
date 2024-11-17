import { Inject, Injectable } from '@nestjs/common';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from './invoke-chain.service';
import { InvokeProcessor } from './invoke.processor';
import { EntriesService } from '../../entries/entries.service';
import { EntryType } from '@prisma/client';

@Injectable()
export class InvokeSepProcessor extends InvokeProcessor {
  getName = (): string => 'InvokeSep';
  constructor(
    @Inject('EntriesService') private readonly entriesService: EntriesService,
  ) {
    super();
  }

  async start(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    const adaptor = this.entriesService.getAdaptor(
      endpoint.adaptorKey,
      EntryType.SERVER,
    );
    const sentry = await this.entriesService.findOne(endpoint.entryId);
    const r = await adaptor.invoke(
      endpoint,
      ctx.sepInvoke.args,
      sentry as any,
      reqEvent,
    );
    if (!r || !r.resumeFunName) return; // got response

    // invoke, resp|async,postprocess
    // ctx.sepInvoke.processor.ctx = r.resumeFunName;
    delete ctx.sepInvoke.processor.fun; // next processor
    return {
      statusCode: 2,
      message: `Server endpoint async invocation will callback later`,
    };
  }
}
