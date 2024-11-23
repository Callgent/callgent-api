import { Inject, Injectable } from '@nestjs/common';
import { EntryType } from '@prisma/client';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import { EntriesService } from '../../entries/entries.service';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeSepCtx } from '../invoke-sep.service';
import { SepProcessor } from './sep.processor';

@Injectable()
export class SepPostprocessProcessor extends SepProcessor {
  getName = (): string => 'InvokePostprocess';
  constructor(
    @Inject('EntriesService') private readonly entriesService: EntriesService,
  ) {
    super();
  }

  async start(
    ctx: InvokeSepCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<PendingOrResponse> {
    this.next(ctx);

    // sep response: { statusCode: 2; message: string } | { data: any }
    const { data: resp, statusCode } = ctx.response;
    // if async, needn't postprocess
    if (statusCode == 2) return;

    const adaptor = this.entriesService.getAdaptor(
      endpoint.adaptorKey,
      EntryType.SERVER,
    );
    const data = await adaptor.postprocess(resp, reqEvent, endpoint);
    ctx.response.data = data;
    return { data };
  }
}
