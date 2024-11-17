import { Inject, Injectable } from '@nestjs/common';
import { EntryType } from '@prisma/client';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { EntriesService } from '../../entries/entries.service';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from './invoke-chain.service';
import { InvokeProcessor } from './invoke.processor';

@Injectable()
export class InvokePostprocessProcessor extends InvokeProcessor {
  getName = (): string => 'InvokePostprocess';
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

    await adaptor.postprocess(reqEvent, endpoint);
    ctx.response = reqEvent.context.resp;
    return { data: ctx.response };
  }
}
