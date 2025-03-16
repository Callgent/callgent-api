import { getTransactionClsKey } from '@nestjs-cls/transactional/dist/src/lib/symbols';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'nestjs-prisma';
import { AbacContextService as PrismaAbacService } from './prisma-abac.service';

/** 'abac.tenantPk'  */
export const prismaAbacUseFactory = (
  newTx: PrismaService,
  tenancyService: PrismaAbacService,
): any =>
  newTx.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const tenantPk = tenancyService.getTenantId();
          const userId = tenancyService.getUserId();

          // tenantPk may be 0
          if (Number.isFinite(tenantPk) || userId) {
            const existingTx = tenancyService.cls.get(getTransactionClsKey());

            // 2 ops
            const set = [
              Number.isFinite(tenantPk) &&
                `set_config('abac.tenantPk', '${tenantPk}', TRUE)`,
              userId && `set_config('abac.userId', '${userId}', TRUE)`,
            ];
            const op = (existingTx || newTx).$executeRawUnsafe(
              'SELECT ' + set.filter((s) => s).join(','),
            );
            if (existingTx) {
              await op;
            } else {
              // TODO ?? store.set(getTransactionClsKey(), newTx);
              const [, result] = await newTx.$transaction([op, query(args)]);
              return result;
            }
          }
          return query(args);
        },
      },
    },
  });

export const ABAC_PRISMA_SERVICE = Symbol('ABAC_PRISMA_SERVICE_TOKEN');

export const PrismaAbacClientProvider = {
  provide: ABAC_PRISMA_SERVICE,
  inject: [PrismaService, PrismaAbacService],
  useFactory: prismaAbacUseFactory,
};
