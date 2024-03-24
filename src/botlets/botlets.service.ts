import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Botlet, Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { UpdateBotletDto } from './dto/update-botlet.dto';
import { BotletCreatedEvent } from './events/botlet-created.event';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class BotletsService {
  private readonly logger = new Logger(BotletsService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenancyService: PrismaTenancyService,
  ) {}
  protected readonly defSelect: Prisma.BotletSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async create(
    dto: Omit<Prisma.BotletUncheckedCreateInput, 'uuid'>,
    select?: Prisma.BotletSelect,
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    const uuid = Utils.uuid();
    const ret: Botlet = await selectHelper(
      select,
      (select) =>
        prisma.botlet.create({
          select,
          data: { ...dto, uuid },
        }),
      this.defSelect,
    );
    this.eventEmitter.emit(
      BotletCreatedEvent.eventName,
      new BotletCreatedEvent(ret),
    );
    return ret;
  }

  findAll({
    select,
    where,
    orderBy = { id: 'desc' },
    page,
    perPage,
  }: {
    select?: Prisma.BotletSelect;
    where?: Prisma.BotletWhereInput;
    orderBy?: Prisma.BotletOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.botlet,
          {
            select,
            where,
            orderBy,
          },
          {
            page,
            perPage,
          },
        );
        return result;
      },
      this.defSelect,
      'data',
    );
  }

  @Transactional()
  delete(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botlet.delete({ select, where: { uuid } }),
    );
  }

  @Transactional()
  update(dto: UpdateBotletDto) {
    if (!dto.uuid) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botlet.update({
        select,
        where: { uuid: dto.uuid },
        data: dto,
      }),
    );
  }

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botlet.findUnique({
        select,
        where: { uuid },
      }),
    );
  }

  @Transactional()
  async duplicateOverTenancy(
    dupUuid: string,
    dto: Omit<Prisma.BotletUncheckedCreateInput, 'uuid'>,
  ) {
    const prisma = this.txHost.tx as PrismaClient;

    await this.tenancyService.bypassTenancy(prisma);
    const dup = await prisma.botlet.findUnique({ where: { uuid: dupUuid } });
    if (!dup)
      throw new NotFoundException('botlet to duplicate not found: ' + dupUuid);

    await this.tenancyService.bypassTenancy(prisma, true);
    const botlet = await this.create(dto, { id: null });
  }
}
