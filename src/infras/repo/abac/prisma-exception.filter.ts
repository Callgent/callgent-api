import {
  ArgumentsHost,
  Catch,
  ForbiddenException,
  HttpServer,
} from '@nestjs/common';
import { APP_FILTER, BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';

@Catch(Prisma?.PrismaClientUnknownRequestError)
export class PrismaClientUnknownExceptionFilter extends BaseExceptionFilter {
  constructor(applicationRef?: HttpServer) {
    super(applicationRef);
  }
  catch(
    exception: Prisma.PrismaClientUnknownRequestError,
    host: ArgumentsHost,
  ) {
    // code: "42501", message: "new row violates row-level security policy for table..
    const rlsError = exception.message.includes('code: "42501"');
    if (rlsError)
      return super.catch(
        new ForbiddenException('You are not allowed to access this resource'),
        host,
      );

    return super.catch(exception, host);
  }
}

export function providePrismaClientUnknownExceptionFilter() {
  return {
    provide: APP_FILTER,
    useFactory: ({ httpAdapter }: HttpAdapterHost) => {
      return new PrismaClientUnknownExceptionFilter(httpAdapter);
    },
    inject: [HttpAdapterHost],
  };
}
