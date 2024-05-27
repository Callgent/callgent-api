import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventStore, Prisma, PrismaClient, ServiceType } from '@prisma/client';
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
  ) {}

  /**
   * @returns: { event, message?, statusCode?: -1-processing, 0-done, 1-pending, >1-error}
   */
  @Transactional()
  async emit<T extends EventObject>(
    event: T,
    timeout = 0,
  ): Promise<{ event: T; statusCode?: number; message?: string }> {
    // load persist listeners
    const listeners = await this.loadListeners(event);

    const result = this._invokeListeners(listeners, event).then((result) =>
      this._invokeCallback(result, true),
    );

    return timeout > 0
      ? Promise.race([
          result,
          Utils.sleep(timeout).then(() => {
            return {
              event,
              statusCode: event.statusCode,
              message: `Sync invocation timeout(${timeout}ms), respond via callback`,
            };
          }),
        ])
      : result;
  }

  /** resume pending event, from external callback */
  @Transactional()
  async resume<T extends EventObject>(
    eventId: string,
  ): Promise<{ event: T; statusCode?: number; message?: string }> {
    const prisma = this.txHost.tx as PrismaClient;
    const event = await prisma.eventStore.findUnique({
      where: { uuid: eventId },
    });
    if (!event) throw new NotFoundException('Event not found, uuid=' + eventId);
    // -1: processing, 0: done, 1: pending, >1: error
    if (event.statusCode <= 0)
      throw new BadRequestException(
        `Cannot resume event with status ${event.statusCode}, uuid=${eventId}`,
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
    result: { event: T; statusCode?: number; message?: string },
    urlOnly = true,
  ): Promise<{ event: T; statusCode?: number; message?: string }> {
    if (result.statusCode) return result; // not done, no cb

    const {
      event: { callbackType, callback },
    } = result;
    if (!callback) return result;
    if (callbackType === 'EVENT')
      return urlOnly ? result : this.resume(callback);

    // URL callback
  }

  private async _invokeListeners<T extends EventObject>(
    listeners: EventListener[],
    event: T,
    funName?: string,
  ): Promise<{ event: T; statusCode?: number; message?: string }> {
    // invoke listeners, supports persisted-async
    let statusCode = -1;
    for (let idx = 0; idx < listeners.length; ) {
      const listener = listeners[idx++];
      try {
        const result = await this._invokeListener(listener, event, funName);
        if (result) {
          result.event && (event = result.event);
          result.funName && (funName = result.funName);
        } else funName = undefined;

        statusCode = funName
          ? 1 // pending
          : event.stopPropagation || idx >= listeners.length
          ? 0 // done
          : -1; // processing
        if (funName || event.stopPropagation) break;
      } catch (e) {
        statusCode = e.status || 2; // error
        const message = (event.message = `[ERROR] ${e.name}: ${e.message}`);
        e.status < 500 || this.logger.error(e);
        return { event, statusCode, message };
      } finally {
        const nextListener =
          statusCode > 0 ? listener : statusCode == 0 ? null : listeners[idx];
        await this.upsertEvent(event, funName, nextListener?.uuid, statusCode);
      }
    }
    return { event, statusCode };
  }

  async loadListeners(
    event: {
      srcId: string;
      eventType: string;
      dataType: string;
    },
    deleted = false,
  ) {
    const { srcId: srcUuid, eventType, dataType } = event;

    const prisma = this.txHost.tx as PrismaClient;
    const AND: Prisma.EventListenerWhereInput[] = [
      {
        OR: [{ srcUuid }, { tenantId: 0, srcUuid: 'GLOBAL' }],
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
          (a.srcUuid === 'GLOBAL' ? -1 : 1) - (b.srcUuid === 'GLOBAL' ? -1 : 1);
        return diff;
      });
    if (!listeners.length)
      throw new BadRequestException(
        `No listeners found for event: ${eventType}:${dataType}`,
      );
    return listeners;
  }

  /** load listeners by event id after event.listenerUuid[including] */
  async resumeListeners(event: EventStore) {
    let listeners = await this.loadListeners(event, true);
    if (event.listenerUuid) {
      const idx = listeners.findIndex(
        (listener) => listener.uuid === event.listenerUuid,
      );
      if (idx < 0)
        throw new NotFoundException(
          `Invalid listener uuid ${event.listenerUuid} for event ${event.uuid}`,
        );

      listeners = listeners.splice(0, idx);
    }
    return listeners.filter((listener) => !listener.deletedAt);
  }

  protected async _invokeListener<T extends EventObject>(
    listener: EventListener,
    event: T,
    funName?: string,
  ): Promise<{ event: T; funName?: string }> {
    if (listener.serviceType == ServiceType.CALLGENT) {
      return this._invokeCallgent(listener, event, funName);
    } else {
      return this._invokeService(listener, event, funName);
    }
  }
  protected async _invokeService<T extends EventObject>(
    target: { uuid: string; serviceName: string; funName: string },
    event: EventObject,
    funName?: string,
  ): Promise<{ event: T; funName?: string }> {
    const service = this.moduleRef.get(target.serviceName, { strict: false });
    if (!service)
      throw new Error(
        `Service ${target.serviceName} not found for event listener#${target.uuid}`,
      );
    const fun = service[funName || target.funName];
    if (!fun)
      throw new Error(
        `Service ${target.serviceName}.${target.funName} not found for event listener#${target.uuid}`,
      );

    return fun.apply(service, [event]);
  }

  protected async _invokeCallgent<T extends EventObject>(
    target: { uuid: string; serviceName: string; funName: string },
    event: T,
    funName?: string,
  ): Promise<{ event: T; funName?: string }> {
    return { event };
  }

  @Transactional()
  addListener(data: CreateEventListenerDto, createdBy: string) {
    data.eventType || (data.eventType = '*');
    data.dataType || (data.dataType = '*');

    const uuid = Utils.uuid();
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventListener.create({ data: { ...data, uuid, createdBy } });
  }

  @Transactional()
  removeListener(where: UpdateEventListenerDto) {
    where.eventType === '' && (where.eventType = '*');
    where.dataType === '' && (where.dataType = '*');

    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventListener.deleteMany({ where });
  }

  @Transactional()
  upsertEvent(
    event: EventObject,
    funName: string,
    listenerUuid: string,
    status: number,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    event.statusCode = status;
    const data: Prisma.EventStoreCreateInput = {
      ...event,
      funName,
      listenerUuid,
    };
    delete (data as any).rawReq;
    return prisma.eventStore.upsert({
      where: { uuid: event.uuid },
      create: data,
      update: data,
    });
  }
}
