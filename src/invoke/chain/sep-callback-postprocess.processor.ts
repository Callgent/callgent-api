import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import { EntriesService } from '../../entries/entries.service';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';
import { SepPostprocessProcessor } from './sep-postprocess.processor';

/** post process from callback result */
@Injectable()
export class SepCallbackPostprocessProcessor extends SepPostprocessProcessor {
  getName = (): string => 'CallbackPostprocess';
  constructor(
    @Inject('EntriesService') entriesService: EntriesService,
    eventEmitter: EventEmitter2,
  ) {
    super(entriesService, eventEmitter);
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
