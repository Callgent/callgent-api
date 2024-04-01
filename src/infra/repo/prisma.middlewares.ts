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
  return {
    prismaOptions: { log: logLevels ? JSON.parse(logLevels) : [] },
    middlewares: [
      loggingMiddleware({
        logger: new Logger('Prisma'),
        logLevel: config.get('LOG_LEVEL'),
      }),
      // TODO, upgrade to extension: https://github.com/olivierwilkinson/prisma-extension-soft-delete
      createSoftDeleteMiddleware({
        models: {
          Tenant: deleteHandle,
          User: deleteHandle,
          UserIdentity: deleteHandle,
          Botlet: deleteHandle,
          BotletApiSchema: deleteHandle,
          BotletApiAction: deleteHandle,
          Task: deleteHandle,
          Endpoint: deleteHandle,
        },
      }),
    ],
  };
};
