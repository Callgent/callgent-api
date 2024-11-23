import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EventListenersService } from '../event-listeners/event-listeners.service';
import { RestApiResponse } from '../restapi/response.interface';
import { CachedDto } from './dto/cached.dto';
import { InvokeCtx } from '../invoke/invoke.service';

/**
 * cache service for server endpoint invocations. especially for async invocations,
 * where promise is cached, when resolved, cache will be updated and callers being informed.
 */
@Injectable()
export class CachedService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    protected readonly eventListenersService: EventListenersService,
  ) {}

  /**
   * try to get invoking response from cache
   */
  @Transactional()
  async fromCached(
    endpoint: EndpointDto,
    reqEvent: ClientRequestEvent,
  ): Promise<{
    cacheKey?: string;
    cacheTtl?: number;
    response?: RestApiResponse<any>;
  }> {
    // -> load:key(default get key), ttl
    const r = this._loadCacheConfig(endpoint, reqEvent);
    // -> realKey = key and (ttl or async), if !realKey: no-cache
    if (!this._reallyCache(r.cacheKey, r.cacheTtl, endpoint)) return r;

    // else find cached,
    //   -> find c=cached[key], if (c and
    let c = await this.findOne(r.cacheKey);
    if (!c) return r; // no cache
    //     -> and (tll-expires or async-cache-done)): delete cache[key],c=null
    let expired = false;
    if (r.cacheTtl) {
      // check expires
      // if async expires, inform observers expired error
    } else if (endpoint.isAsync) {
      // not pending
      expired = c.response?.statusCode != 2;
    } else expired = true;
    if (expired) {
      await this.delete({ pk: c.pk });
      c = null;
    }
    if (!c) return r; // no cache

    //   -> if c-not-done: reg event-id, observe c.event-id
    if (endpoint.isAsync && c.response?.statusCode == 2)
      await this.addObserver(c.pk, reqEvent.id);

    //   -> return c
    return Object.assign(r, { response: c.response });
  }

  /**
   * save to cache
   * @param {boolean} needUpdate whether cache need callback update
   */
  @Transactional()
  async toCache(
    response: { statusCode?: 2; message?: string; data?: any },
    { cacheKey, cacheTtl }: { cacheKey?: string; cacheTtl?: number },
    endpoint: EndpointDto,
  ) {
    //   -> if realKey(key and (ttl or async)), cached[key] = resp
    if (!this._reallyCache(cacheKey, cacheTtl, endpoint)) return false;

    // save to cache
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.cached
      .create({ data: { cacheKey, response, eventIds: [] } })
      .then((d) => !!d);
  }

  /**
   * update async response and inform observers, even expired.
   * @returns false if cache not found
   */
  @Transactional()
  async updateCache(
    response: { data: any },
    { cacheKey, cacheTtl }: { cacheKey?: string; cacheTtl?: number },
    endpoint: EndpointDto,
  ) {
    if (!this._reallyCache(cacheKey, cacheTtl, endpoint)) return false;

    //   -> get key from event, cached[key] = response
    const c = await this.findOne(cacheKey);
    if (!c) return false;
    c.response = response;
    this.update(c.pk, response);

    //   -> inform all observer events:[resume processing], bound to current event-id
    this.notifyObservers(c); // no await
    return true;
  }

  async findOne(cacheKey: string): Promise<CachedDto & { pk: bigint }> {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.cached.findUnique({
      where: { cacheKey },
    }) as any;
  }

  async addObserver(pk: bigint, eventId: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.cached.update({
      where: { pk },
      data: { eventIds: { push: eventId } },
    });
  }

  /** notify observer event to resume processing */
  async notifyObservers(c: CachedDto & { pk: bigint }) {
    const { eventIds, response } = c;

    // trigger resume processing, needn't await
    // grouped notify, preventing resource exhaustion
    const groups = this._group(eventIds, 6);
    for (const eIds of groups) {
      await Promise.all(
        eIds.map((eId) =>
          this.eventListenersService.resume(eId, async (event) => {
            event.statusCode = response.statusCode;
            event.message = response.message as string;
            // update sep response
            const invocation: InvokeCtx = (event.context as any).invocation;
            invocation.sepInvoke.response = response.data;
            return event;
          }),
        ),
      );
    }
  }

  /**
   * @returns string[][:10]
   */
  private _group(eventIds: string[], chunkSize = 10) {
    const ids = [...new Set(eventIds)];
    const result: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize)
      result.push(eventIds.slice(i, i + chunkSize));
    return result;
  }

  async update(pk: bigint, response: any) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.cached.update({ where: { pk }, data: { response } });
  }

  async delete(where: { pk: bigint } | { cacheKey: string }) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.cached.delete({ where });
  }

  protected _reallyCache(
    cacheKey: string,
    cacheTtl: number,
    endpoint: EndpointDto,
  ) {
    return cacheKey && (cacheTtl || endpoint.isAsync);
  }

  /** load cache config from sentry/adaptor/sep */
  private _loadCacheConfig(
    endpoint: EndpointDto,
    reqEvent: ClientRequestEvent,
  ): { cacheKey?: any; cacheTtl?: any } {
    return {};
  }
}
