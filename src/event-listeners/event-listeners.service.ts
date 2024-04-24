import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { CreateEventListenerDto } from './dto/create-event-listener.dto';
import { UpdateEventListenerDto } from './dto/update-event-listener.dto';
import { EventObject } from './event-object';

/**
 * @see https://nodejs.org/api/events.html
 */
@Injectable()
export class EventListenersService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    @Inject(ModulesContainer) private modulesContainer: ModulesContainer,
  ) {}

  async emit(event: EventObject, timeout = 0): Promise<void> {
    const { srcUuid, eventType, dataType } = event;
    const prisma = this.txHost.tx as PrismaClient;

    // load persist listeners
    let listeners = await prisma.eventListener.findMany({
      where: {
        AND: [
          {
            OR: [{ srcUuid }, { tenantId: 0, srcUuid: 'GLOBAL' }],
          },
          { OR: [{ eventType }, { dataType }] },
        ],
      },
    });
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

    // invoke listeners, supports persisted-async
  }

  @Transactional()
  addListener(data: CreateEventListenerDto, createdBy: string) {
    data.eventType || (data.eventType = '*');
    data.dataType || (data.dataType = '*');

    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventListener.create({ data: { ...data, createdBy } });
  }

  @Transactional()
  removeListener(where: UpdateEventListenerDto) {
    where.eventType === '' && (where.eventType = '*');
    where.dataType === '' && (where.dataType = '*');

    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventListener.deleteMany({ where });
  }
}
