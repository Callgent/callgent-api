import { Inject, Injectable } from '@nestjs/common';
import { EntryType } from '@prisma/client';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import { EntriesService } from '../../entries/entries.service';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';
import { SepProcessor } from './sep.processor';

@Injectable()
export class SepInvokeProcessor extends SepProcessor {
  getName = (): string => 'InvokeSep';
  constructor(
    @Inject('EntriesService') private readonly entriesService: EntriesService,
  ) {
    super();
  }

  async _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<PendingOrResponse> {
    const adaptor = this.entriesService.getAdaptor(
      endpoint.adaptorKey,
      EntryType.SERVER,
    );
    const sentry = await this.entriesService.findOne(endpoint.entryId);

    // whether async or not, go on to next processor
    return adaptor.invoke(endpoint, ctx.args, sentry as any, reqEvent, ctx);
  }
}
