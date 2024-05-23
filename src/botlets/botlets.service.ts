import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Botlet, Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';
import { CreateBotletDto } from './dto/create-botlet.dto';
import { UpdateBotletDto } from './dto/update-botlet.dto';
import { BotletCreatedEvent } from './events/botlet-created.event';

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
    dto: CreateBotletDto,
    createdBy: string,
    select?: Prisma.BotletSelect,
  ) {
    const data = dto as Prisma.BotletUncheckedCreateInput;
    (data.uuid = Utils.uuid()), (data.createdBy = createdBy);

    const prisma = this.txHost.tx as PrismaClient;
    const ret: Botlet = await selectHelper(
      select,
      (select) => prisma.botlet.create({ select, data }),
      this.defSelect,
    );
    await this.eventEmitter.emitAsync(
      BotletCreatedEvent.eventName,
      new BotletCreatedEvent({ ...data, ...ret }),
    );
    return ret;
  }

  @Transactional()
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
  async findMany(uuids: string[], select?: Prisma.BotletSelect) {
    const prisma = this.txHost.tx as PrismaClient;

    const botlets = await selectHelper(
      select,
      async (select) =>
        await prisma.botlet.findMany({
          where: { uuid: { in: uuids } },
          select,
        }),
      this.defSelect,
    );

    if (botlets.length != uuids.length)
      throw new NotFoundException(
        `Botlet not found, uuid=${uuids
          .filter((x) => !botlets.find((y) => y.uuid == x))
          .join(', ')}`,
      );
    return botlets;
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

  @Transactional()
  findOne(uuid: string, select?: Prisma.BotletSelect) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      (select) =>
        prisma.botlet.findUnique({
          select,
          where: { uuid },
        }),
      this.defSelect,
    );
  }

  @Transactional()
  async duplicateOverTenancy(
    dupUuid: string,
    dto: CreateBotletDto,
    createdBy: string,
  ) {
    const prisma = this.txHost.tx as PrismaClient;

    await this.tenancyService.bypassTenancy(prisma);
    const dup = await prisma.botlet.findUnique({ where: { uuid: dupUuid } });
    if (!dup)
      throw new NotFoundException('botlet to duplicate not found: ' + dupUuid);

    await this.tenancyService.bypassTenancy(prisma, false);
    const botlet = await this.create(dto, createdBy, { id: null });
  }

  /**
   * Cross tenancy execution when client endpoint is provided.
   * [endpoint://]botlet.please('act', with_args)
   * @param act API action name
   * @param endpoint client endpoint to call API. unnecessary in internal calls
   */
  @Transactional()
  async please(
    act: string,
    args: any[],
    endpoint: { botletUuid: string; uuid?: string; adaptorKey?: string },
  ) {
    // invoke botlet action api, through endpoint
    const prisma = this.txHost.tx as PrismaClient;
    const withEndpoint = endpoint?.uuid || endpoint?.adaptorKey;

    // load targets
    if (withEndpoint) this.tenancyService.bypassTenancy(prisma);
    const [botlet, actions, epClient] = await Promise.all([
      prisma.botlet.findUnique({ where: { uuid: endpoint.botletUuid } }),
      prisma.botletFunction.findMany({
        where: { name: act, botletUuid: endpoint.botletUuid },
      }),
      withEndpoint &&
        prisma.endpoint.findFirst({ where: { ...endpoint, type: 'CLIENT' } }),
    ]);

    // check targets
    if (!botlet)
      throw new NotFoundException('botlet not found: ' + endpoint.botletUuid);
    if (actions.length === 0)
      throw new NotFoundException(
        `botlet=${endpoint.botletUuid} API action not found: ${act}`,
      );
    if (withEndpoint) {
      if (!epClient)
        throw new NotFoundException(
          `Client endpoint not found for botlet=${endpoint.botletUuid}: ${
            endpoint.uuid || endpoint.adaptorKey
          }`,
        );
      this.tenancyService.setTenantId(botlet.tenantId);
      this.tenancyService.bypassTenancy(prisma, false);
    }

    let action;
    if (actions.length > 1) {
      // FIXME: match action by args
      action = actions[0];
    } else action = actions[0];

    // pre-meta, pre-routing, pre-mapping
  }
}
