import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventObject } from '../event-listeners/event-object';
import { Utils } from '../infra/libs/utils';

@Injectable()
export class EventStoresService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  /** create random targetId if not set, else load all events of targetId */
  async loadTargetEvents(event: EventObject) {
    const { id, targetId } = event;
    if (targetId) {
      const prisma = this.txHost.tx as PrismaClient;
      const es = await prisma.eventStore.findMany({
        select: { id: true, eventType: true, dataType: true, data: true }, // TODO, what to select
        where: { AND: [{ NOT: { id } }, { targetId }] },
        orderBy: { id: 'asc' },
      });
      if (!es?.length)
        throw new NotFoundException('Invalid event.targetId: ' + targetId);
      event.context.tgtEvents = es;
    } else event.targetId = Utils.uuid(); // create new targetId
  }
}
