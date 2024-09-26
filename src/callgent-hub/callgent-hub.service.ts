import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CallgentRealm, Prisma, PrismaClient } from '@prisma/client';
import { CallgentFunctionsService } from '../callgent-functions/callgent-functions.service';
import { CallgentRealmsService } from '../callgent-realms/callgent-realms.service';
import { RealmSecurityVO } from '../callgent-realms/dto/realm-security.vo';
import { CallgentsService } from '../callgents/callgents.service';
import { CreateCallgentDto } from '../callgents/dto/create-callgent.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';

@Injectable()
export class CallgentHubService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tenancyService: PrismaTenancyService,
    private readonly callgentsService: CallgentsService,
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
    @Inject('CallgentFunctionsService')
    private readonly callgentFunctionsService: CallgentFunctionsService,
  ) {}

  @Transactional()
  /** hub are those in tenantPk = -1 */
  private async _onHubAction<T>(fn: () => Promise<T>): Promise<T> {
    const tenantPk = this.tenancyService.getTenantId();
    try {
      this.tenancyService.setTenantId(-1);
      return await fn.apply(this);
    } finally {
      this.tenancyService.setTenantId(tenantPk);
    }
  }

  async findAllInHub(params: {
    select?: Prisma.CallgentSelect;
    where?: Prisma.CallgentWhereInput;
    orderBy?: Prisma.CallgentOrderByWithRelationInput;
    page?: number;
    perPage?: number;
  }) {
    return this._onHubAction(() => this.callgentsService.findMany(params));
  }

  /**
   * Callgent, Endpoint, CallgentFunction, CallgentRealm.
   */
  @Transactional()
  async duplicateFromHub(
    dupId: string,
    dto: CreateCallgentDto,
    createdBy: string,
  ) {
    const from = await this._onHubAction(async () => {
      const prisma = this.txHost.tx as PrismaClient;
      const dup = await prisma.callgent.findUnique({
        where: { id: dupId },
        select: {
          pk: true,
          id: true,
          name: true,
          summary: true,
          endpoints: {
            select: {
              id: true,
              name: true,
              type: true,
              adaptorKey: true,
              priority: true,
              host: true,
              initParams: true,
              content: true,
              securities: true,
            },
          },
        },
      });
      if (!dup)
        throw new NotFoundException('Callgent in hub not found: ' + dupId);
      return dup;
    });

    const eps = from.endpoints;
    from.endpoints = undefined;
    const callgent = await this.callgentsService.create(
      { ...from, ...dto, duplicatePk: from.pk },
      createdBy,
    );
    const callgentId = callgent.id;

    const realms = await this.callgentRealmsService.findAll({
      where: { callgentId: from.id },
      orderBy: { pk: 'asc' },
      select: {
        pk: true,
        realmKey: true,
        authType: true,
        realm: true,
        scheme: true,
        secret: false, // don't duplicate secret
        perUser: true,
      },
    });
    const realmMap: { [pk: number]: CallgentRealm } = {};
    await Promise.all(
      realms.map(async (r) => {
        const realm = await this.callgentRealmsService.create({
          ...r,
          callgentId,
        });
        realmMap[r.pk] = realm;
      }),
    );

    const endpointMap = {};
    await Promise.all(
      eps.map(async (epOld) => {
        const securities: any[] = dupSecurities(epOld.securities);

        const ep = await this.endpointsService.create({
          ...epOld,
          callgentId,
          securities,
          createdBy,
        });
        endpointMap[epOld.id] = ep;

        const functions = await this.callgentFunctionsService.findAll({
          where: { endpointId: epOld.id },
          orderBy: { pk: 'asc' },
          select: {
            name: true,
            path: true,
            method: true,
            summary: true,
            description: true,
            securities: true,
            params: true,
            responses: true,
            rawJson: true,
          },
        });
        functions.map((fun) => {
          const securities: any[] = dupSecurities(fun.securities);
          this.callgentFunctionsService.create({
            ...fun,
            securities,
            callgentId,
            endpointId: ep.id,
            createdBy,
          });
        });
      }),
    );
    return callgent;

    function dupSecurities(securities: any[]): RealmSecurityVO[] {
      return securities?.map((security) => {
        const ret: RealmSecurityVO = {};
        Object.values(security).forEach((item: any) => {
          const realm = realmMap[item.realmPk];
          ret['' + realm.pk] = { ...item, realmPk: realm.pk };
        });
        return ret;
      });
    }
  }

  /**
   * Callgent, Endpoint, CallgentFunction, CallgentRealm.
   */
  @Transactional()
  async duplicateToHub(
    dupId: string,
    dto: CreateCallgentDto,
    createdBy: string,
  ) {}
}
