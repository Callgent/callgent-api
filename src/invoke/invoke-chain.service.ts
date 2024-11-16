import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EntriesService } from '../entries/entries.service';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';

/** sep invoke chain: auth, cache, adaptor.invoke, adaptor.postprocess,  */
@Injectable()
export class InvokeChainService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
  ) {}

  run(
    ctx: ChainCtx,
    reqEvent: ClientRequestEvent,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    if (!ctx.sepInvoke) {
      // no specific ep, just sentry auth, then go
    }

    const { epName } = ctx.sepInvoke;
    if (!epName)
      throw new Error('[sepInvoke] epName must not empty, id=' + reqEvent.id);

    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    const endpoint = endpoints.find((e) => e.name == epName);

    return null;
  }
}

export class ChainCtx {
  callbackName: string;
  response: any;
  sepInvoke: { epName: string };
}
