import { PendingOrResponse } from '../entries/adaptors/entry-adaptor.base';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { Utils } from '../infras/libs/utils';
import { InvokeSepService } from './invoke-sep.service';
import { InvokeCtx } from './invoke.service';

export class RequestMacro<T extends { [name: string]: string }> {
  constructor(
    private readonly memberFunctions: T,
    private invokeSepService: InvokeSepService,
    private readonly reqEvent: ClientRequestEvent,
  ) {
    // single ep to invoke
    const { epName } = reqEvent.context;
    if (!epName) return; // multiple eps invocation

    // default main function, for
    this.main = async (
      args: any,
      // context: { [varName: string]: any },
    ): Promise<
      | { cbMemberFun: string; message: string }
      | { data?: any; statusCode?: number; message?: string }
    > => {
      const r = await this.invokeService(epName, args);
      if ((r as any).statusCode == 2)
        return { ...r, cbMemberFun: '$defaultEpCb' };
      if ('data' in r) return this.$defaultEpCb(r.data, {}); // succeed
      return r;
    };
    // this.main = this.chainify(this.main); // main is not chained
    this.$defaultEpCb = this.chainify((d) => d); // needn't process, resp already in reqEvent
  }

  /** process starting point */
  declare main: MemberFunction;

  /**
   * default callback, called by default main
   * @param args adaptor.postprocess result parsed in here
   * @returns null, since response already in reqEvent
   */
  declare $defaultEpCb: MemberFunction;

  /**
   * init invoke chain ctx, and run chain.
   * only successful responses returned in $.data; else throws error
   */
  private async invokeService(
    epName: string,
    args: any,
    // config: EntryDto,
  ): Promise<PendingOrResponse> {
    // init chain ctx
    const invocation: InvokeCtx = this.reqEvent.context.invocation;
    if (invocation.sepInvoke)
      Object.assign(invocation.sepInvoke, { epName, args });
    else invocation.sepInvoke = { epName, args };
    return this.invokeSepService.chain(invocation.sepInvoke, this.reqEvent);
  }

  public getProxy(): {
    [K in keyof T]: MemberFunction;
  } {
    return new Proxy(this, this.handler) as any;
  }

  private handler: ProxyHandler<RequestMacro<T>> = {
    get: (target: RequestMacro<T>, prop: string | symbol) => {
      if (prop in target) return target[prop];
      if (typeof prop === 'string' && prop in target.memberFunctions) {
        const fun = Utils.toFunction<MemberFunction>(
          target.memberFunctions[prop],
        );

        // resume invoke ctx chain
        const chained: MemberFunction = target.chainify(fun);
        return (target[prop] = chained);
      }
    },
  };

  /** wrap member function with invoke chain, to continue async sep invocation */
  private chainify(fun: MemberFunction): MemberFunction {
    const self = this;
    return async function (args: any, context: { [varName: string]: any }) {
      const ctx: InvokeCtx = self.reqEvent.context.invocation;
      // chain result
      const r = await self.invokeSepService.chain(ctx.sepInvoke, self.reqEvent);
      if (r) {
        if ('statusCode' in r) {
          // statusCode always 2
          return {
            cbMemberFun: ctx.currentFun,
            message: r.message,
          };
        }
        if ('data' in r) args = r.data;
      }
      return fun(args, context);
    };
  }
}

type MemberFunction = (
  args: any,
  context: { [varName: string]: any },
) => Promise<
  | { cbMemberFun: string; message: string }
  | { data?: any; statusCode?: number; message?: string }
>;
