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

  /** create random tgtId if not set, else check if exists */
  async upsertTgtId(event: EventObject) {
    if (event.tgtId) {
      const prisma = this.txHost.tx as PrismaClient;
      const e = await prisma.eventStore.findFirst({
        select: { id: true },
        where: { tgtId: event.tgtId },
      });
      if (!e)
        throw new NotFoundException('Invalid event.tgtId: ' + event.tgtId);
    } else event.tgtId = Utils.uuid(); // create new tgtId
  }
}
