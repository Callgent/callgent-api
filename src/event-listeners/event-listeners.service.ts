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
   * @returns no-empty means pending
   */
  @Transactional()
  async emit(event: EventObject, timeout = 0) {
    // load persist listeners
    const listeners = await this.loadListeners(event);

    // save event
    // await this.saveEvent(event);

    const result = this._invokeListeners(listeners, event);

    // FIXME: timeout returns what
    return timeout > 0 ? Promise.race([result, Utils.sleep(timeout)]) : result;
  }

  /** resume pending event */
  @Transactional()
  async resume(eventId: string) {
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
    return this._invokeListeners(listeners, event as any, event.funName);
  }

  private async _invokeListeners(
    listeners: EventListener[],
    event: EventObject,
    funName?: string,
  ) {
    // invoke listeners, supports persisted-async
    let status = -1;
    for (let idx = 0; idx < listeners.length; ) {
      const listener = listeners[idx++];
      try {
        const result = await this._invokeListener(listener, event, funName);
        if (result) {
          if (Array.isArray(result)) [event, funName] = result;
          else event = result;
        } else funName = undefined;

        status = funName
          ? 1 // pending
          : event.stopPropagation || idx >= listeners.length
          ? 0 // done
          : -1; // processing
        if (funName || event.stopPropagation) return [event, funName];
      } catch (e) {
        status = 2; // error
        event.message = `[ERROR] ${e.name}: ${e.message}`;
        this.logger.error(e);
        return; // fail stop
      } finally {
        const nextListener =
          status > 0 ? listener : status == 0 ? null : listeners[idx];
        await this.upsertEvent(event, funName, nextListener?.uuid, status);
      }
    }
    return event;
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

  protected async _invokeListener(
    listener: EventListener,
    event: EventObject,
    funName?: string,
  ) {
    if (listener.serviceType == ServiceType.BOTLET) {
      return this._invokeBotlet(listener, event, funName);
    } else {
      return this._invokeService(listener, event, funName);
    }
  }
  protected async _invokeService(
    target: { uuid: string; serviceName: string; funName: string },
    event: EventObject,
    funName?: string,
  ) {
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

  protected async _invokeBotlet(
    target: { uuid: string; serviceName: string; funName: string },
    event: EventObject,
    funName?: string,
  ) {}

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
