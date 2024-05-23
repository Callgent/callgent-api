import { getTransactionClsKey } from '@nestjs-cls/transactional/dist/src/lib/symbols';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from 'nestjs-prisma';
import { PrismaTenancyService } from './prisma-tenancy.service';

/** 'tenancy.tenantId'  */
export const prismaTenancyUseFactory = (
  newTx: PrismaService,
  store: ClsService,
): any =>
  newTx.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const tenantId = store.get(PrismaTenancyService.TENANT_ID_KEY);

          if (tenantId) {
            const existingTx = store.get(getTransactionClsKey());

            // 2 ops
            const op = (existingTx || newTx)
              .$executeRaw`SELECT set_config('tenancy.tenantId', ${tenantId.toString()}, TRUE)`;
            if (existingTx) {
              await op;
            } else {
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
