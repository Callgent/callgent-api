import { Inject, Injectable } from '@nestjs/common';
import { CallgentRealmsService } from '../../callgent-realms/callgent-realms.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../../entries/events/client-request.event';
import { ChainCtx } from './invoke-chain.service';
import { InvokeProcessor } from './invoke.processor';

@Injectable()
export class InvokeAuthProcessor extends InvokeProcessor {
  getName = (): string => 'InvokeAuth';
  constructor(
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {
    super();
  }

  async start(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
    endpoint: EndpointDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    const fun: Function =
      this.callgentRealmsService[ctx.sepInvoke.processor.ctx || 'checkSepAuth'];
    const r: { resumeFunName?: string } = await fun.call(
      this.callgentRealmsService,
      endpoint,
      reqEvent,
    );

    if (r?.resumeFunName) {
      ctx.sepInvoke.processor.ctx = r.resumeFunName;
      return {
        statusCode: 2,
        message: 'Server endpoint authentication: ' + r.resumeFunName,
      };
    }

    delete ctx.sepInvoke.processor.fun; // to next processor
  }
}
