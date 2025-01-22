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
export class SepPostprocessProcessor extends SepProcessor {
  getName = (): string => 'InvokePostprocess';
  constructor(
    @Inject('EntriesService') protected readonly entriesService: EntriesService,
  ) {
    super();
  }

  async _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
    preData: { data?: any; statusCode?: 2 },
  ): Promise<PendingOrResponse> {
    // sep response: { statusCode: 2; message: string } | { data: any }
    const { data: rawResp, statusCode } = preData;
    // if async, needn't postprocess
    if (statusCode == 2) return preData;

    const adaptor = this.entriesService.getAdaptor(
      endpoint.adaptorKey,
      EntryType.SERVER,
    );
    const data = await adaptor.postprocess(rawResp, reqEvent, endpoint, ctx);
    return { data };
  }
}
