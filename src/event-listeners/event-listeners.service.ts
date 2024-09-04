import {
  Propagation,
  TransactionHost,
  Transactional,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventStore, Prisma, PrismaClient, ServiceType } from '@prisma/client';
import { EventStoresService } from '../event-stores/event-stores.service';
import { Utils } from '../infra/libs/utils';
import { CreateEventListenerDto } from './dto/create-event-listener.dto';
import { UpdateEventListenerDto } from './dto/update-event-listener.dto';
import { EventListener } from './entities/event-listener.entity';
import { EventObject } from './event-object';

/**
 * @see https://nodejs.org/api/events.html
 */
@Injectable()
export class EventListenersService {
  private readonly logger = new Logger(EventListenersService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly moduleRef: ModuleRef,
    @Inject('EventStoresService')
    private readonly eventStoresService: EventStoresService,
  ) {}

  /**
   * @returns: { data: event, message?, statusCode?: 1-processing, 0-done, 2-pending, (<0 || >399)-error}
   */
  @Transactional()
  async emit<T extends EventObject>(
    data: T,
    timeout = 0,
  ): Promise<{ data: T; statusCode?: number; message?: string }> {
    // load persist listeners
    const listeners = await this.loadListeners(data);

    // timeout response will cause current tx close, so Propagation.RequiresNew!
    const result = this._invokeListeners(listeners, data).then((result) =>
      this._invokeCallback(result, true),
    );

    return timeout > 0
      ? Promise.race([
          result,
          Utils.sleep(timeout).then(() => ({
            data: { ...data, rawReq: undefined },
            statusCode: data.statusCode,
            message: `Sync invocation timeout(${timeout}ms), will respond via callback`,
          })),
        ])
      : result;
  }

  loadEvent = (eventId: string) => this.eventStoresService.findOne(eventId);

  /** resume pending event, from external callback */
  @Transactional()
  async resume<T extends EventObject>(
    event: string | EventStore,
  ): Promise<{ data: T; statusCode?: number; message?: string }> {
    if (typeof event === 'string')
      event = (await this.loadEvent(event)) || event;
    if (!event || typeof event === 'string')
      throw new NotFoundException('Event not found, id=' + event);

    // 1: processing, 0: done, 2: pending, <0: error
    if (event.statusCode != 2)
      throw new BadRequestException(
        `Cannot resume event with status ${event.statusCode}, id=${event.id}`,
      );

    const listeners = await this.resumeListeners(event);
    const result = await this._invokeListeners(
      listeners,
      event as any,
      event.funName,
    );
    return this._invokeCallback(result);
  }

  /**
   * @param urlOnly `EVENT` type callback only applicable on resuming
   */
  protected async _invokeCallback<T extends EventObject>(
    result: { data: T; statusCode?: number; message?: string },
    urlOnly = true,
  ): Promise<{ data: T; statusCode?: number; message?: string }> {
    if (result.statusCode) return result; // not done, no cb

    const {
      data: { callbackType, callback },
    } = result;
    if (!callback) return result;
    if (callbackType === 'EVENT')
      return urlOnly ? result : this.resume(callback);

    // URL callback
  }

  /** timeout response will cause current tx close, so Propagation.RequiresNew! */
  @Transactional(Propagation.RequiresNew)
  protected async _invokeListeners<T extends EventObject>(
    listeners: EventListener[],
    data: T,
    funName?: string,
  ): Promise<{ data: T; statusCode?: number; message?: string }> {
    // invoke listeners, supports persisted-async
    let statusCode = 1;
    for (let idx = 0; idx < listeners.length; ) {
      const listener = listeners[idx++];
      try {
        const result = await this._invokeListener(listener, data, funName);
        if (result) {
          result.data && (data = result.data);
          result.resumeFunName && (funName = result.resumeFunName);
        } else funName = undefined;

        statusCode = funName
          ? 2 // pending
          : data.stopPropagation || idx >= listeners.length
          ? 0 // done
          : 1; // processing
        if (funName || data.stopPropagation) break;
      } catch (e) {
        statusCode = e.status || -1; // error
        const message = (data.message = `[ERROR] ${e.name}: ${e.message}`);
        e.status < 500 || this.logger.error(e);
        return { data: data, statusCode, message };
      } finally {
        const nextListener =
          statusCode == 1
            ? listeners[idx] // processing: next
            : statusCode == 0 || (statusCode > 2 && statusCode < 399)
            ? null // success: null
            : listener; // error/pending: current

        await this.eventStoresService.upsertEvent(
          data,
          funName,
          nextListener?.id,
          statusCode,
        );
      }
    }
    return { data: data, statusCode };
  }

  async loadListeners(
    data: {
      srcId: string;
      eventType: string;
      dataType: string;
    },
    deleted = false,
  ) {
    const { srcId: srcId, eventType, dataType } = data;

    const prisma = this.txHost.tx as PrismaClient;
    const AND: Prisma.EventListenerWhereInput[] = [
      {
        OR: [{ srcId }, { tenantPk: 0, srcId: 'GLOBAL' }],
      },
      { OR: [{ eventType }, { dataType }] },
    ];
    deleted &&
      AND.push({
        OR: [{ deletedAt: null }, { deletedAt: { not: null } }],
      });

    let listeners = await prisma.eventListener.findMany({ where: { AND } });
    listeners = listeners
      .filter(
        (listener) =>
          (listener.eventType === eventType || listener.eventType === '*') &&
          (listener.dataType === dataType || listener.dataType === '*'),
      )
      .sort((a, b) => {
        const diff =
          a.priority - b.priority ||
          (a.srcId === 'GLOBAL' ? -1 : 1) - (b.srcId === 'GLOBAL' ? -1 : 1);
        return diff;
      });
    if (!listeners.length)
      throw new BadRequestException(
        `No listeners found for event: ${eventType}:${dataType}`,
      );
    return listeners;
  }

  /** load listeners by event id after event.listenerId[including] */
  async resumeListeners(data: EventStore) {
    let listeners = await this.loadListeners(data, true);
    if (data.listenerId) {
      const idx = listeners.findIndex(
        (listener) => listener.id === data.listenerId,
      );
      if (idx < 0)
        throw new NotFoundException(
          `Invalid listener id ${data.listenerId} for event ${data.id}`,
        );

      listeners = listeners.splice(0, idx);
    }
    return listeners.filter((listener) => !listener.deletedAt);
  }

  @Transactional()
  protected async _invokeListener<T extends EventObject>(
    listener: EventListener,
    data: T,
    funName?: string,
  ): Promise<{ data: T; resumeFunName?: string }> {
    if (listener.serviceType == ServiceType.CALLGENT) {
      return this._invokeCallgent(listener, data, funName);
    } else {
      return this._invokeService(listener, data, funName);
    }
  }

  /** service.func_signature(event): Promise<{ data: T; funName?: string }> */
  @Transactional()
  protected async _invokeService<T extends EventObject>(
    target: { id: string; serviceName: string; funName: string },
    data: EventObject,
    funName?: string,
  ): Promise<{ data: T; funName?: string }> {
    const service = this.moduleRef.get(target.serviceName, { strict: false });
    if (!service)
      throw new Error(
        `Service ${target.serviceName} not found for event listener#${target.id}`,
      );
    const fun = service[funName || target.funName];
    if (!fun)
      throw new Error(
        `Service ${target.serviceName}.${target.funName} not found for event listener#${target.id}`,
      );

    return fun.apply(service, [data]);
  }

  @Transactional()
  protected async _invokeCallgent<T extends EventObject>(
    target: { id: string; serviceName: string; funName: string },
    data: T,
    funName?: string,
  ): Promise<{ data: T; resumeFunName?: string }> {
    return { data };
  }

  @Transactional()
  addListener(data: CreateEventListenerDto, createdBy: string) {
    data.eventType || (data.eventType = '*');
    data.dataType || (data.dataType = '*');

    const id = Utils.uuid();
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventListener.create({ data: { ...data, id, createdBy } });
  }

  @Transactional()
  removeListener(where: UpdateEventListenerDto) {
    where.eventType === '' && (where.eventType = '*');
    where.dataType === '' && (where.dataType = '*');

    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventListener.deleteMany({ where });
  }
}
