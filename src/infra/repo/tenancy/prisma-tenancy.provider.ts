import { getTransactionClsKey } from '@nestjs-cls/transactional/dist/src/lib/symbols';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'nestjs-prisma';
import { PrismaTenancyService } from './prisma-tenancy.service';

/** 'tenancy.tenantPk'  */
export const prismaTenancyUseFactory = (
  newTx: PrismaService,
  store: ClsService,
): any =>
  newTx.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const tenantPk = store.get(PrismaTenancyService.TENANT_ID_KEY);

          // may be 0
          if (Number.isFinite(tenantPk)) {
            const existingTx = store.get(getTransactionClsKey());

            // 2 ops
            const op = (existingTx || newTx)
              .$executeRaw`SELECT set_config('tenancy.tenantPk', ${tenantPk.toString()}, TRUE)`;
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

export type ExtendedTenantClient = ReturnType<typeof prismaTenancyUseFactory>;

export const TENANTED_PRISMA_SERVICE = Symbol('TENANTED_PRISMA_SERVICE_TOKEN');

export const PrismaTenancyClientProvider = {
  provide: TENANTED_PRISMA_SERVICE,
  inject: [PrismaService, ClsService],
  useFactory: prismaTenancyUseFactory,
};
