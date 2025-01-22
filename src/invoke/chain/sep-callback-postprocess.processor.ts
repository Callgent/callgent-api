import { Inject, Injectable } from '@nestjs/common';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import { EntriesService } from '../../entries/entries.service';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';
import { SepPostprocessProcessor } from './sep-postprocess.processor';

@Injectable()
export class SepCallbackPostprocessProcessor extends SepPostprocessProcessor {
  getName = (): string => 'CallbackPostprocess';
  constructor(@Inject('EntriesService') entriesService: EntriesService) {
    super(entriesService);
  }

  async _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
    preData: { data?: any; statusCode?: 2 },
  ): Promise<PendingOrResponse> {
    return super._process(ctx, reqEvent, endpoint, preData);
  }
}
