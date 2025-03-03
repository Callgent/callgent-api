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
  UnprocessableEntityException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EventStore, Prisma, PrismaClient, ServiceType } from '@prisma/client';
import { EventStoresService } from '../event-stores/event-stores.service';
import { Utils } from '../infras/libs/utils';
import { InvokeService } from '../invoke/invoke.service';
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
    private readonly invokeService: InvokeService,
  ) {}

  /**
   * @returns: { data: event, message?, statusCode?: 1-processing, 0-done, 2-pending, (<0 || >399)-error}
   */
  @Transactional()
  async emit<T extends EventObject>(data: T, timeout = 0): Promise<T> {
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
            ...data,
            statusCode: 1,
            message: `Sync invocation timeout(${timeout}ms), will respond via callback`,
          })),
        ])
      : result;
  }

  loadEvent = (eventId: string) => this.eventStoresService.findOne(eventId);

  /**
   * resume pending event, from external callback
   * @param invokeKey: `invokeId-eventId`
   */
  @Transactional()
  async resume<T extends EventObject>(
    invokeKey: string,
    callbackResponse: any,
  ): Promise<T> {
    const { eventId, invokeId } = this.invokeService.parseInvokeKey(invokeKey);
    const event = await this.loadEvent(eventId);
    if (!event) throw new NotFoundException('Event not found, id=' + invokeId);
    if (event.statusCode != 2)
      throw new BadRequestException(
        `Cannot resume event with status ${event.statusCode}, id=${invokeId}`,
      );

    // prepare callback context
    this.invokeService.setCallbackResponse(
      invokeId,
      callbackResponse,
      event as any,
    );
    const listeners = await this.resumeListeners(event);
    if (!listeners.length)
      throw new UnprocessableEntityException(
        `Failed to resume: no listeners found for event, id=${invokeId}`,
      );

    const result = await this._invokeListeners(
      listeners,
      event as any, // TODO?
      event.funName,
    );
    return this._invokeCallback(result);
  }

  /**
   * @param urlOnly `EVENT` type callback only applicable on resuming
   */
  protected async _invokeCallback<T extends EventObject>(
    data: T,
    urlOnly = true,
  ): Promise<T> {
    if (data.statusCode) return data; // not done, no cb

    // FIXME
    const { callbackType, callback } = data;
    if (!callback) return data;
    if (callbackType === 'EVENT')
      return urlOnly ? data : this.resume('', callback); // FIXME

    // URL callback
  }

  /** timeout response will cause current tx close, so Propagation.RequiresNew! */
  @Transactional(Propagation.RequiresNew)
  protected async _invokeListeners<T extends EventObject>(
    listeners: EventListener[],
    event: T,
    funName?: string,
  ): Promise<T> {
    // invoke listeners, supports persisted-async
    let idx = 0;
    event.statusCode = 1; // processing
    try {
      for (; idx < listeners.length; ) {
        if (event.stopPropagation) break;

        const listener = listeners[idx++];
        try {
          const result = await this._invokeListener(listener, event, funName);
          // if no result, reuse event
          result?.data && (event = result.data);
          // if no result, empty funName
          funName = result?.resumeFunName;

          event.statusCode = funName
            ? 2 // pending
            : event.stopPropagation || idx >= listeners.length
              ? 0 // done
              : 1; // processing
          if (funName || event.stopPropagation) break;
        } catch (e) {
          event.statusCode = e.status || -1; // error
          event.message = e.response?.data?.message || `${e.message}`;
          e.status < 500 || this.logger.error(e);
          return event;
        }
      }
      return event;
    } finally {
      const nextListener =
        event.statusCode == 1
          ? listeners[idx] // processing: next
          : event.statusCode == 0 ||
              (event.statusCode > 2 && event.statusCode < 399)
            ? null // success: null
            : listeners[idx - 1]; // error/pending: current
      await this.eventStoresService.upsertEvent(
        event,
        funName || null,
        nextListener?.id || null,
      );
    }
  }

  async loadListeners(
    {
      srcId,
      eventType,
      dataType,
    }: {
      srcId: string;
      eventType: string;
      dataType: string;
    },
    deleted = false,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const AND: Prisma.EventListenerWhereInput[] = [
      {
        OR: [{ srcId }, { srcId: '*' }],
      },
      {
        OR: [{ eventType }, { eventType: '*' }],
      },
      {
        OR: [{ dataType }, { dataType: '*' }],
      },
    ];
    deleted && AND.push({ deletedAt: { gte: 0 } });

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
          (a.srcId === '*' ? -1 : 1) - (b.srcId === '*' ? -1 : 1);
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
    const listeners = await this.loadListeners(data, true);

    if (data.listenerId) {
      const idx = listeners.findIndex((l) => l.id == data.listenerId);
      if (idx < 0)
        throw new NotFoundException(
          `Invalid listener id ${data.listenerId} for event ${data.id}`,
        );
      idx > 0 && listeners.splice(0, idx);
    }

    return listeners.filter((listener) => !listener.deletedAt);
  }

  @Transactional()
  protected async _invokeListener<T extends EventObject>(
    listener: EventListener,
    event: T,
    funName?: string,
  ): Promise<{ data: T; resumeFunName?: string }> {
    if (listener.serviceType == ServiceType.CALLGENT) {
      return this._invokeCallgent(listener, event, funName);
    } else {
      return this._invokeService(listener, event, funName);
    }
  }

  /** service.func_signature(event): Promise<{ data: T; funName?: string }> */
  @Transactional()
  protected async _invokeService<T extends EventObject>(
    target: { id: string; serviceName: string; funName: string },
    event: EventObject,
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

    return fun.apply(service, [event]);
  }

  @Transactional()
  protected async _invokeCallgent<T extends EventObject>(
    target: { id: string; serviceName: string; funName: string },
    event: T,
    funName?: string,
  ): Promise<{ data: T; resumeFunName?: string }> {
    return { data: event };
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
