import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { EntriesService } from '../entries/entries.service';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { RequestMacro } from './request.macro';

@Injectable()
export class InvokeService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
  ) {}

  /** invoke SEPs based on generated RequestService */
  @Transactional()
  async invokeSEPs(reqEvent: ClientRequestEvent) {
    // map2Endpoints: { endpoints, requestArgs, macroParams, macroResponse, memberFunctions }
    const { map2Endpoints, endpoints } = reqEvent.context;
    if (!endpoints?.length)
      throw new Error('Failed to invoke, No mapping endpoint found');

    const invocation: { currentFun: string; args: any; context: {} } =
      reqEvent.context.invocation ||
      (reqEvent.context.invocation = {
        currentFun: 'main',
        args: map2Endpoints.requestArgs,
        context: {},
      });

    const requestMacro = new RequestMacro(
      map2Endpoints.memberFunctions as { [name: string]: string },
      reqEvent,
      this.entriesService,
    ).getProxy();
    const fun = requestMacro[invocation.currentFun];
    try {
      const ret = await fun(invocation.context, invocation.args);
      const resp = { statusText: ret.message };
      if ('callbackName' in ret) {
        // will callback with response in invocation.args
        invocation.currentFun = ret.callbackName;
        reqEvent.context.resp = {
          statusText: ret.message,
          status: 2,
          data: null,
        };
        // still go into invokeSEPs
        return { data: reqEvent, resumeFunName: 'invokeSEPs' };
      }
      // final response
      // reqEvent.context.resp = ret.data; // postprocess has done this
    } catch (e) {
      // FIXME
      throw e;
    }

    // const func = endpoints[0] as EndpointDto;
    // const sen =
    //   sentry ||
    //   (await this.findOne(func.entryId, {
    //     id: true,
    //     name: true,
    //     type: true,
    //     adaptorKey: true,
    //     priority: true,
    //     host: true,
    //     content: true,
    //     callgentId: true,
    //     callgent: { select: { id: true, name: true } },
    //   }));
    // const adapter = sen && this.getAdaptor(sen.adaptorKey, EntryType.SERVER);
    // if (!adapter) throw new Error('Failed to invoke, No SEP adaptor found');

    // // may returns pending result
    // return adapter
    //   .invoke(func, map2Endpoints.args, sen as any, reqEvent)
    //   .then((res) => {
    //     if (res && res.resumeFunName) return res;
    //     return this.postInvokeSEP((res && res.data) || reqEvent);
    //   });
  }
}
