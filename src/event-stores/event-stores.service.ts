import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { EventObject } from '../event-listeners/event-object';
import { Utils } from '../infras/libs/utils';
import { ClientRequestEvent } from '../entries/events/client-request.event';

@Injectable()
export class EventStoresService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  /** load all events of taskId if not empty */
  async loadClientEventHistories(event: ClientRequestEvent) {
    const { id, taskId } = event;
    if (!taskId) return;

    const prisma = this.txHost.tx as PrismaClient;
    const es = await prisma.eventStore.findMany({
      select: {
        id: true,
        dataType: true,
        context: true,
        statusCode: true,
        message: true,
      },
      where: {
        AND: [{ NOT: { id } }, { taskId }, { eventType: 'CLIENT_REQUEST' }],
      },
      orderBy: { pk: 'asc' },
    });
    if (es?.length) event.histories = es as any[]; // current event is not included
  }

  findOne(eventId: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.eventStore.findUnique({
      where: { id: eventId },
    });
  }

  @Transactional()
  upsertEvent(event: EventObject, funName: string, listenerId: string) {
    if (event.statusCode === 0) {
      // if event success, keep the latest listenerId and funName
      funName || (funName = undefined);
      listenerId || (listenerId = undefined);
    }

    const prisma = this.txHost.tx as PrismaClient;
    const data: Prisma.EventStoreCreateInput = {
      ...event,
      context: event.context,
      stopPropagation: event.stopPropagation,
      funName,
      listenerId,
    };
    return prisma.eventStore.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    });
  }
}
