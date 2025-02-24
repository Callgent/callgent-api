import { Inject, Injectable } from '@nestjs/common';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { PendingOrResponse } from '../entries/adaptors/entry-adaptor.base';
import {
  ClientRequestEvent,
  InvokeStatus,
} from '../entries/events/client-request.event';
import { SepProcessor } from './chain/sep.processor';

export const INVOKE_CHAIN_LIST = Symbol('INVOKE_CHAIN_LIST');

/** sep invoke chain: auth, cache, adaptor.invoke, adaptor.postprocess,  */
@Injectable()
export class InvokeSepService {
  constructor(
    @Inject(INVOKE_CHAIN_LIST)
    private readonly processors: SepProcessor[],
  ) {}

  /**
   * invoke a service endpoint through processor chain: auth/cache/..
   * @param status invoke status
   * @param reqEvent with request context
   * @returns endpoint response, or pending status
   * @throws chain error
   */
  async chain(
    status: InvokeStatus,
    reqEvent: ClientRequestEvent,
  ): Promise<PendingOrResponse> {
    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    const endpoint = endpoints.find((e) => e.name == status.epName);
    if (!endpoint)
      throw new Error(
        `Endpoint not Found: ${status.epName}, event.id=${reqEvent.id}`,
      );

    // first or not end
    if (!status.processor || status.processor.name) {
      let preData: PendingOrResponse = { data: status.response };
      for (let i = 0; i < this.processors.length; i++) {
        const p = this.processors[i];
        if (!status.processor) {
          status.processor = { name: p.getName() }; // first processor
        } else if (p.getName() != status.processor.name) continue;

        // invoke processor
        const next = this.processors.at(i + 1)?.getName();
        const { stop, data } = await p.process(
          status,
          reqEvent,
          endpoint,
          next,
          preData,
        );
        preData = data;
        if (stop) return data;
      }
    } else {
      // skip all processors, sep invoke done, @see processor.end()
      return { data: status.response };
    }
  }
}
