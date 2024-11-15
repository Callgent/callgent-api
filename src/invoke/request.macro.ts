import { BadRequestException } from '@nestjs/common';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { Utils } from '../infra/libs/utils';
import { EntriesService } from '../entries/entries.service';
import { EntryDto } from '../entries/dto/entry.dto';
import { EntryType } from '@prisma/client';

export class RequestMacro<T extends { [name: string]: string }> {
  constructor(
    private readonly memberFunctions: T,
    private readonly reqEvent: ClientRequestEvent,
    private readonly entriesService: EntriesService,
  ) {
    // single ep to invoke
    const { epName } = reqEvent.context;
    if (!epName) return; // multiple eps invocation
    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    const endpoint = endpoints.find((e) => e.name == epName);
    if (!endpoint)
      throw new BadRequestException('Endpoint not exists: ' + epName);

    // default main function, for
    this.main = async (
      context: { [varName: string]: any },
      args: any,
    ): Promise<
      | { callbackName: string; message: string }
      | { data?: any; statusCode?: number; message?: string }
    > => {
      const r = await this.serviceInvoke(epName);
      if ('statusCode' in r && r.statusCode == 2)
        return { ...r, callbackName: '$defaultEpCb' };
      if ('data' in r) return this.$defaultEpCb({}, r.data); // succeed
      return r;
    };
    this.$defaultEpCb = () => null;
  }

  /** process starting point */
  declare main: (
    context: { [varName: string]: any },
    args: any,
  ) => Promise<
    | { callbackName: string; message: string }
    | { data?: any; statusCode?: number; message?: string }
  >;

  /**
   * default callback, called by default main
   * @param args adaptor.postprocess result parsed in here
   * @returns null, since response already in reqEvent
   */
  declare $defaultEpCb: (
    context: { [varName: string]: any },
    args: any,
  ) => Promise<
    | { callbackName: string; message: string }
    | { data?: any; statusCode?: number; message?: string }
  >;

  /**
   * invoke sep, plus chained auth/cache/.. interceptors.
   * only successful responses returned in $.data; else throws error
   */
  private async serviceInvoke(
    epName: string,
  ): Promise<{ statusCode: 2; message: string } | { data: any }> {
    return null;
  }

  public getProxy(): {
    [K in keyof T]: (
      context: { [varName: string]: any },
      args: any,
    ) => Promise<
      | { callbackName: string; message: string }
      | { data?: any; statusCode?: number; message?: string }
    >;
  } {
    return new Proxy(this, this.handler) as any;
  }

  private handler: ProxyHandler<RequestMacro<T>> = {
    get: (target: RequestMacro<T>, prop: string | symbol) => {
      if (prop in target) return target[prop];
      if (typeof prop === 'string' && prop in target.memberFunctions)
        return (target[prop] = Utils.toFunction(
          target.memberFunctions[prop],
        ).bind(target));
    },
  };
}
