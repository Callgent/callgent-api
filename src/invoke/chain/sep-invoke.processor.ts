import { Inject, Injectable } from '@nestjs/common';
import { EntryType } from '@prisma/client';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { EntriesService } from '../../entries/entries.service';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeSepCtx } from '../invoke-sep.service';
import { SepProcessor } from './sep.processor';

@Injectable()
export class SepInvokeProcessor extends SepProcessor {
  getName = (): string => 'InvokeSep';
  constructor(
    @Inject('EntriesService') private readonly entriesService: EntriesService,
  ) {
    super();
  }

  async start(
    ctx: InvokeSepCtx,
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
      ctx.args,
      sentry as any,
      reqEvent,
    );

    // whether async or not, go on to next processor
    this.next(ctx);
    ctx.response = r;
    return; // do not return r, because even async resp, we go on to cache
  }
}
