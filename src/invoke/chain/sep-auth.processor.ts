import { Inject, Injectable } from '@nestjs/common';
import { CallgentRealmsService } from '../../callgent-realms/callgent-realms.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../../entries/events/client-request.event';
import { SepProcessor } from './sep.processor';

@Injectable()
export class SepAuthProcessor extends SepProcessor {
  getName = (): string => 'InvokeAuth';
  constructor(
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {
    super();
  }

  protected async _process(
    ctx: InvokeStatus,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<PendingOrResponse> {
    // processor.ctx as resumeFunName
    const fun: Function =
      this.callgentRealmsService[ctx.processor.ctx || 'checkSepAuth'];
    const r: { resumeFunName?: string } = await fun.call(
      this.callgentRealmsService,
      endpoint,
      reqEvent,
    );

    // pending
    if (r?.resumeFunName) {
      ctx.processor.ctx = r.resumeFunName;
      this.break(ctx, true); // break chain, next time re-enter current processor
      return { statusCode: 2 };
    }
  }
}
