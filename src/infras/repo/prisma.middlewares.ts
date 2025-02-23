import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaServiceOptions, loggingMiddleware } from 'nestjs-prisma';
import { createSoftDeleteMiddleware } from 'prisma-soft-delete-middleware';

const deleteHandle = {
  field: 'deletedAt',
  createValue: (deleted: boolean) => (deleted ? new Date() : null),
};

export const mainPrismaServiceOptions = (
  config: ConfigService,
): PrismaServiceOptions => {
  const logLevels = config.get('LOG_LEVELS_PRISMA');
  const slowSqlTh = parseInt(config.get('SLOW_SQL_THRESHOLD', '10000'));
  const txTimeout = parseInt(config.get('PRISMA_TRANSACTION_TIMEOUT', '5000'));
  return {
    prismaOptions: {
      errorFormat: 'pretty',
      log: logLevels ? JSON.parse(logLevels) : [],
      transactionOptions: {
        timeout: txTimeout,
      },
    },
    middlewares: [
      loggingMiddleware({
        logger: new Logger('Prisma'),
        logLevel: config.get('LOG_LEVEL'),
        logMessage: (query) =>
          `${query.model || ''}.${query.action} took \x1b[3${
            query.executionTime > slowSqlTh ? '1' : '2'
          }m${query.executionTime}ms\x1b[0m`,
      }),
      // TODO, upgrade to extension: https://github.com/olivierwilkinson/prisma-extension-soft-delete
      createSoftDeleteMiddleware({
        models: {
          Tenant: deleteHandle,
          User: deleteHandle,
          UserIdentity: deleteHandle,
          // need to exclude soft deleted records in a compound findUnique operation
          // https://github.com/olivierwilkinson/prisma-soft-delete-middleware?tab=readme-ov-file#excluding-soft-deleted-records-in-a-findunique-operation
          Callgent: { ...deleteHandle, allowCompoundUniqueIndexWhere: true },
          Endpoint: deleteHandle,
          Entry: deleteHandle,
          Transaction: deleteHandle,
        },
      }),
    ],
  };
};
