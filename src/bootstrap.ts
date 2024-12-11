// import compression from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifyMultipart from '@fastify/multipart';
import {
  Logger as ConsoleLogger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { FastifyRequest } from 'fastify';
import fastifyIp from 'fastify-ip';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AuthUtils } from './infras/auth/auth.utils';
import { JwtAuthService } from './infras/auth/jwt/jwt-auth.service';

async function bootstrap(app: NestFastifyApplication, port: string) {
  const configService = app.get(ConfigService);

  // (BigInt.prototype as any).toJSON = function () {
  //   return this.toString();
  // };

  // pino logger
  const logger: ConsoleLogger = registerLogger(app);

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
  });

  app.register(helmet);
  app.register(fastifyIp);
  const fileSize = configService.get('REQUEST_BODY_LIMIT', 1048576); // 1M
  app.register(fastifyMultipart, {
    throwFileSizeLimit: true,
    limits: { fileSize: parseInt(fileSize), files: 8 },
  });
  // app.register(compression);

  // express compatibility
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance
    .decorateReply('set', function (header: any) {
      const [key, value] = Object.entries(header)[0];
      this.header(key, value);
    })
    .decorateReply('status', function (code: number) {
      return this.code(code);
    })
    .decorateReply('locals', function () {
      return this.context;
    });

  const { devDocVersion } = registerApi(
    app,
    1,
    'Callgent APIs',
    'The <a href="https://callgent.com/" target="_blank">Callgent</a> APIs. Download <a href="api-json" target="_blank">Callgent-openAPI.json</a>, or <a href="api-yaml" target="_blank">Callgent-openAPI.yaml</a>',
    logger,
  );

  //// validation
  app.useGlobalPipes(
    new ValidationPipe({
      enableDebugMessages: !!devDocVersion,
      disableErrorMessages: !devDocVersion,
      validationError: {
        target: !!devDocVersion,
        value: !!devDocVersion,
      },
      whitelist: true, // remove all properties not defined in the param class
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
      dismissDefaultMessages: false,
      transform: true,
    }),
  );
  ///// validator injection: e.g. EntityIdExistsRule
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  if (configService.get('ALLOW_CORS'))
    app.register(fastifyCors, {
      origin: [
        process.env.FRONTEND_SITE_URL,
        process.env.FRONTEND_DOCS_URL,
        process.env.FRONTEND_APP_URL,
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true, // allow cookie
    });

  if (AuthUtils.getAuthCookieName(configService))
    await app.register(fastifyCookie);

  await app.listen(port, '::', () =>
    logger.warn('Application is listening on port ' + port),
  );
  return app;
}

export async function bootstrapForProd(): Promise<NestFastifyApplication> {
  const bodyLimit = parseInt(process.env.REQUEST_BODY_LIMIT) || 1048576;
  const app: NestFastifyApplication =
    await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        trustProxy: true,
        bodyLimit,
      }),
      { abortOnError: false, bufferLogs: true },
    );
  return bootstrap(app, process.env.PORT || '3000');
}

export async function bootstrapForTest(
  moduleFixtureForTest: any,
): Promise<NestFastifyApplication> {
  let app: NestFastifyApplication =
    await moduleFixtureForTest.createNestApplication(new FastifyAdapter(), {
      abortOnError: true,
      bufferLogs: false,
    });
  app = await bootstrap(app, process.env.PORT || '0');
  const logger: ConsoleLogger = registerLogger(app);
  logger.warn('Application running from moduleFixtureForTest!!!!!!');
  return app;
}

/**
 * swagger doc is enabled only in dev mode, when devDocVersion is not empty.
 *
 * @param {sting} testUserId used on dev swagger doc
 * @returns {{ defaultApiVersion, devDocVersion }} api/doc versions
 */
function registerApi(
  app: NestFastifyApplication,
  testUserId: number,
  docTitle: string,
  docDesc: string,
  logger: ConsoleLogger,
  apiPrefix = 'api',
) {
  app.setGlobalPrefix(apiPrefix);

  // https://www.thisdot.co/blog/nestjs-api-versioning-strategies
  // header 'x-api-version' based versioning
  // matching version from high to low.
  const configService = app.get(ConfigService);
  const defaultApiVersion = configService.get<string>(
    'DEFAULT_API_VERSION',
    '1',
  );
  const extractor = (request: FastifyRequest): string | string[] => {
    const requestedVersion =
      <string>request.headers['x-api-version'] ?? defaultApiVersion;
    // If requested version is N, then this generates an array like: ['N', 'N-1', 'N-2', ... , '1']
    return Array.from(
      { length: parseInt(requestedVersion) },
      (_, i) => `${i + 1}`,
    ).reverse();
  };
  app.enableVersioning({
    type: VersioningType.CUSTOM,
    extractor,
    defaultVersion: defaultApiVersion,
  });

  ////// fastify cookie support
  // await app.register(fastifyCookie, {
  //   secret: configService.getOrThrow<string>('COOKIE_SECRET'), // for cookies signature
  // });

  ///// api docs
  const devDocVersion = configService.get<string>('DOCUMENTATION_VERSION');
  if (devDocVersion) {
    const devJwtToken = app.get(JwtAuthService).sign({
      tenantPk: 1,
      id: testUserId,
      iss: 'test.only',
      sub: 'TEST_USER_ID',
      aud: 'test.client.id',
      username: 'user@example.com',
    });
    // console.debug('devJwtToken:', devJwtToken);

    const config = new DocumentBuilder()
      .setTitle(docTitle)
      .setDescription(docDesc)
      .setVersion(devDocVersion)
      // .addBearerAuth(schema, 'defaultBearerAuth')
      .addSecurity('defaultBearerAuth', {
        type: 'apiKey',
        in: 'header',
        name: 'x-callgent-authorization',
      })
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs/api', app, document, {
      swaggerOptions: {
        authAction: {
          defaultBearerAuth: {
            schema: { type: 'apiKey', in: 'header' },
            value: devJwtToken,
          },
        },
      },
    });

    logger.log(
      `API Documentation: http://localhost:${
        process.env.PORT || 3000
      }/docs/api`,
    );
  }

  return { defaultApiVersion, devDocVersion };
}
function registerLogger(app: NestFastifyApplication) {
  try {
    const logger: ConsoleLogger = app.get(Logger);
    app.useLogger(logger);
    app.useGlobalInterceptors(new LoggerErrorInterceptor());
    return logger;
  } catch (e) {
    // empty
  }
  return new ConsoleLogger('bootstrap');
}
