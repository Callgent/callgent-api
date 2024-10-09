import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallgentRealm, Prisma, PrismaClient } from '@prisma/client';
import { CallgentFunctionsService } from '../callgent-functions/callgent-functions.service';
import { CallgentRealmsService } from '../callgent-realms/callgent-realms.service';
import { RealmSecurityVO } from '../callgent-realms/dto/realm-security.vo';
import { CallgentsService } from '../callgents/callgents.service';
import { CreateCallgentDto } from '../callgents/dto/create-callgent.dto';
import { EntriesService } from '../entries/entries.service';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';

@Injectable()
export class CallgentHubService {
  public readonly hubTenantPK = -1;
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tenancyService: PrismaTenancyService,
    private readonly callgentsService: CallgentsService,
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
    @Inject('CallgentFunctionsService')
    private readonly callgentFunctionsService: CallgentFunctionsService,
  ) {}

  @Transactional()
  /** hub are those in tenantPk = -1 */
  private async _onHubAction<T>(fn: () => Promise<T>): Promise<T> {
    const tenantPk = this.tenancyService.getTenantId();
    try {
      this.tenancyService.setTenantId(this.hubTenantPK);
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
   * Callgent, Entry, CallgentFunction, CallgentRealm.
   */
  @Transactional()
  async forkFromHub(dupId: string, dto: CreateCallgentDto, createdBy: string) {
    const currentTenant = this.tenancyService.getTenantId();
    return this._duplicateCallgent(
      dupId,
      dto,
      createdBy,
      this.hubTenantPK,
      currentTenant,
    );
  }

  /**
   * Callgent, Entry, CallgentFunction, CallgentRealm.
   */
  @Transactional()
  async commitToHub(dupId: string, dto: CreateCallgentDto, createdBy: string) {
    const currentTenant = this.tenancyService.getTenantId();
    return this._duplicateCallgent(
      dupId,
      dto,
      createdBy,
      currentTenant,
      this.hubTenantPK,
    );
  }

  protected async _duplicateCallgent(
    fromId: string,
    dto: CreateCallgentDto,
    createdBy: string,
    fromTenant: number,
    toTenant: number,
  ) {
    const origTenant = this.tenancyService.getTenantId();
    try {
      this.tenancyService.setTenantId(fromTenant);
      const from = await this.callgentsService.findOne(fromId, {
        pk: true,
        id: true,
        name: true,
        summary: true,
        entries: {
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
      });
      if (!from) throw new NotFoundException();
      if (toTenant == this.hubTenantPK && from.forkedPk) {
        // to hub
        throw new BadRequestException(
          'Only original callgent can be committed to hub.',
        );
      } else {
        // from hub
        const prisma = this.txHost.tx as PrismaClient;
        await prisma.callgent.update({
          where: { id: fromId },
          select: { id: true },
          data: { forked: { increment: 1 } },
        });
      }

      const ens = from.entries;
      from.entries = undefined;
      this.tenancyService.setTenantId(toTenant);
      const callgent = await this.callgentsService.create(
        { ...from, ...dto, forkedPk: from.pk },
        createdBy,
      );
      const callgentId = callgent.id;

      this.tenancyService.setTenantId(fromTenant);
      const realms = await this.callgentRealmsService.findAll({
        where: { callgentId: from.id },
        orderBy: { pk: 'asc' },
        select: {
          pk: true,
          realmKey: true,
          authType: true,
          realm: true,
          scheme: true,
          secret: false, // don't fork secret
          perUser: true,
        },
      });
      this.tenancyService.setTenantId(toTenant);
      const realmMap: { [pk: number]: CallgentRealm } = {};
      await Promise.all(
        realms.map(async (r) => {
          const realm = await this.callgentRealmsService.create(
            {
              ...r,
              callgentId,
            },
            { pk: null },
          );
          realmMap[r.pk] = realm;
        }),
      );

      this.tenancyService.setTenantId(fromTenant);
      const functionMap = {};
      await Promise.all(
        ens.map(async (epOld) => {
          const functions = await this.callgentFunctionsService.findAll({
            where: { entryId: epOld.id },
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
          functionMap[epOld.id] = functions;
        }),
      );

      this.tenancyService.setTenantId(toTenant);
      await Promise.all(
        ens.map(async (epOld) => {
          const securities: any[] = dupSecurities(epOld.securities);

          const ep = await this.entriesService.create({
            ...epOld,
            callgentId,
            securities,
            createdBy,
          });

          return Promise.all(
            functionMap[epOld.id].map((fun) => {
              const securities: any[] = dupSecurities(fun.securities);
              return this.callgentFunctionsService.create({
                ...fun,
                securities,
                callgentId,
                entryId: ep.id,
                createdBy,
              });
            }),
          );
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
    } finally {
      this.tenancyService.setTenantId(origTenant);
    }
  }
}
