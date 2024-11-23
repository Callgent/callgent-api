import { Inject, Injectable } from '@nestjs/common';
import { CallgentRealmsService } from '../../callgent-realms/callgent-realms.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../../entries/adaptors/entry-adaptor.base';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { InvokeSepCtx } from '../invoke-sep.service';
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

  async start(
    ctx: InvokeSepCtx,
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

    if (r?.resumeFunName) {
      ctx.processor.ctx = r.resumeFunName;
      return {
        statusCode: 2,
        message: 'Server endpoint authentication: ' + r.resumeFunName,
      };
    }

    this.next(ctx);
  }
}
