import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PaginatorTypes, paginator } from '@nodeteam/nestjs-prisma-pagination';
import { Prisma, PrismaClient } from '@prisma/client';
import { ApiSpec } from '../endpoints/adaptors/endpoint-adaptor.interface';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { UpdateBotletApiActionDto } from './dto/update-botlet-api-action.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class BotletApiActionsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly endpointsService: EndpointsService,
  ) {}
  protected readonly defSelect: Prisma.BotletApiActionSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async createBatch(endpoint: EndpointDto, apis: ApiSpec, createdBy: string) {
    const { actions, schemas } = apis;

    // validation
    const actMap = actions.map<Prisma.BotletApiActionUncheckedCreateInput>(
      (e) => {
        if (endpoint.type != 'SERVER')
          throw new BadRequestException(
            'endpoint must be of type `SERVER`, uuid=' + endpoint.uuid,
          );
        return {
          ...e,
          uuid: Utils.uuid(),
          endpointUuid: endpoint.uuid,
          botletUuid: endpoint.botletUuid,
          createdBy: createdBy,
        };
      },
    );
    const schMap = schemas.map<Prisma.BotletApiSchemaUncheckedCreateInput>(
      (e) => ({
        ...e,
        uuid: Utils.uuid(),
        botletUuid: endpoint.botletUuid,
        createdBy: createdBy,
      }),
    );

    const prisma = this.txHost.tx as PrismaClient;
    const [{ count: actionsCount }] = await Promise.all([
      await prisma.botletApiAction.createMany({ data: actMap }),
      await prisma.botletApiSchema.createMany({ data: schMap }),
    ]);
    return actionsCount;
  }

  async importBatch(
    endpoint: EndpointDto,
    apiTxt: { text: string; format?: string },
    createdBy: string,
  ) {
    const adaptor = this.endpointsService.getAdaptor(endpoint.adaptorKey);
    const apis = await adaptor.parseApis(apiTxt);
    return this.createBatch(endpoint, apis, createdBy);
  }

  findAll({
    select,
    where,
    orderBy = { id: 'desc' },
    page,
    perPage,
  }: {
    select?: Prisma.BotletApiActionSelect;
    where?: Prisma.BotletApiActionWhereInput;
    orderBy?: Prisma.BotletApiActionOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.botletApiAction,
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
      prisma.botletApiAction.delete({ select, where: { uuid } }),
    );
  }

  @Transactional()
  update(dto: UpdateBotletApiActionDto) {
    if (!dto.uuid) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletApiAction.update({
        select,
        where: { uuid: dto.uuid },
        data: dto,
      }),
    );
  }

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletApiAction.findUnique({
        select,
        where: { uuid },
      }),
    );
  }
}
