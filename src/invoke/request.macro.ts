import { ClientRequestEvent } from '../entries/events/client-request.event';
import { Utils } from '../infras/libs/utils';
import { ChainCtx, InvokeChainService } from './chain/invoke-chain.service';

export class RequestMacro<T extends { [name: string]: string }> {
  constructor(
    private readonly memberFunctions: T,
    private invokeChainService: InvokeChainService,
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
      | { callbackName: string; message: string }
      | { data?: any; statusCode?: number; message?: string }
    > => {
      const r = await this.serviceInvoke(epName, args);
      if ('statusCode' in r && r.statusCode == 2)
        return { ...r, callbackName: '$defaultEpCb' };
      if ('data' in r) return this.$defaultEpCb({}, r.data); // succeed
      return r;
    };
    // this.main = this.chainify(this.main); // main is not chained
    this.$defaultEpCb = () => null; // needn't process, resp already in reqEvent
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
  private async serviceInvoke(
    epName: string,
    args: any,
    // config: EntryDto,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    // init chain ctx
    const invocation: ChainCtx = this.reqEvent.context.invocation;
    invocation.sepInvoke = { epName, args };
    return this.invokeChainService.run(invocation, this.reqEvent);
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

  /** wrap member function with invoke chain */
  private chainify(fun: MemberFunction): MemberFunction {
    const self = this;
    return async function (args: any, context: { [varName: string]: any }) {
      const invocation: ChainCtx = self.reqEvent.context.invocation;
      const r = await self.invokeChainService.run(
        self.reqEvent.context.invocation,
        self.reqEvent,
      );
      if (r) {
        if ('statusCode' in r) {
          // statusCode always 2
          return {
            callbackName: invocation.callbackName,
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
  | { callbackName: string; message: string }
  | { data?: any; statusCode?: number; message?: string }
>;
