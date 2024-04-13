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
import { UpdateBotletMethodDto } from './dto/update-botlet-method.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class BotletMethodsService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly endpointsService: EndpointsService,
  ) {}
  protected readonly defSelect: Prisma.BotletMethodSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  @Transactional()
  async createBatch(endpoint: EndpointDto, spec: ApiSpec, createdBy: string) {
    if (endpoint.type != 'SERVER')
      throw new BadRequestException(
        'endpoint must be of type `SERVER`, uuid=' + endpoint.uuid,
      );

    const { apis } = spec;
    // validation
    const actMap = apis.map<Prisma.BotletMethodUncheckedCreateInput>((e) => {
      return {
        ...e,
        uuid: Utils.uuid(),
        endpointUuid: endpoint.uuid,
        botletUuid: endpoint.botletUuid,
        createdBy: createdBy,
      };
    });

    const prisma = this.txHost.tx as PrismaClient;
    const { count: actionsCount } = await prisma.botletMethod.createMany({
      data: actMap,
    });
    return actionsCount;
  }

  @Transactional()
  async importBatch(
    endpoint: EndpointDto,
    apiTxt: { text: string; format?: string },
    createdBy: string,
  ) {
    const apis = await this.endpointsService.parseApis(endpoint, apiTxt);
    return this.createBatch(endpoint, apis, createdBy);
  }

  findAll({
    select,
    where,
    orderBy = { id: 'desc' },
    page,
    perPage,
  }: {
    select?: Prisma.BotletMethodSelect;
    where?: Prisma.BotletMethodWhereInput;
    orderBy?: Prisma.BotletMethodOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.botletMethod,
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

  findMany(args: {
    select?: Prisma.BotletMethodSelect;
    where?: Prisma.BotletMethodWhereInput;
    orderBy?: Prisma.BotletMethodOrderByWithRelationInput;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.botletMethod.findMany({ ...args });
  }

  @Transactional()
  delete(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletMethod.delete({ select, where: { uuid } }),
    );
  }

  @Transactional()
  update(dto: UpdateBotletMethodDto) {
    if (!dto.uuid) return;
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletMethod.update({
        select,
        where: { uuid: dto.uuid },
        data: dto,
      }),
    );
  }

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.botletMethod.findUnique({
        select,
        where: { uuid },
      }),
    );
  }
}
