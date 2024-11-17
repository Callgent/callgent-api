import { Transactional } from '@nestjs-cls/transactional';
import { Inject, Injectable } from '@nestjs/common';
import { EntryType } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EntriesService } from '../entries/entries.service';
import { ClientRequestEvent } from '../entries/events/client-request.event';

/**
 * cache service for server endpoint invocations. especially for async invocations,
 * where promise is cached, when resolved, cache will be updated and callers being informed.
 */
@Injectable()
export class CachedService {
  constructor(
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
  ) {}

  /**
   * try to get invoking response from cache
   */
  @Transactional()
  async fromCached(
    endpoint: EndpointDto,
    reqEvent: ClientRequestEvent,
  ): Promise<{ data: any }> {
    // retrieve cache config(CacheKey/CacheTTL), from ep/entry/adaptor
    // const { endpoints, sentry } = reqEvent.context;
    // const func = endpoints[0] as EndpointDto;

    // const sen = sentry || (await this.entriesService.findOne(func.entryId));
    // const adapter =
    //   sen && this.entriesService.getAdaptor(sen.adaptorKey, EntryType.SERVER);
    // if (!adapter) throw new Error('Failed to invoke, No SEP adaptor found');

    // get from cache
    // if exists, return
    // reqEvent.stopPropagation = true;
    return null;
  }

  /**
   * try to get invoking response from cache
   */
  @Transactional()
  async toCache(endpoint: EndpointDto, reqEvent: ClientRequestEvent) {
    // retrieve cache config(CacheKey/CacheTTL), from ep/entry/adaptor
    // get from cache
    // if exists, return
    // reqEvent.stopPropagation = true;
  }
}
