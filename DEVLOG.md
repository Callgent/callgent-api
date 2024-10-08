# Developer Guide

This is guide for developers to setup the development environment. Before you start to get prepared for the develop environment, you need to make sure your basic tools are installed correctly.

* Nodejs (Notice: To build the project, the right version is needed, otherwise installation can not be corrected, see .node-version)
* pnpm
* docker

## Development Setup

* copy `.env.dev` to `.env`

* install dependencies

  ```shell
  pnpm i
  ```

* install dababase postgres with vector plugin

  ```shell
  docker pull ankane/pgvector
  ```

* start postgres db in docker

  ```shell
  docker run --name callgent-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e PG_VECTOR_EXTENSION=true -d ankane/pgvector
  ```

* init db

  ```shell
  npx prisma generate # generate PrismaClient
  npx prisma migrate dev # init db schema
  npx prisma db seed # init db data
  ```

* init db test data

  ```shell
  npx prisma migrate reset # reset db to initial state
  pnpm run prisma:seed-test # init db test data
  ```

* start server

  ```shell
  pnpm run start:dev
  ```

If all the above steps are done, and nothing failed, you can access the API at `http://localhost:3000/api`

* run tests

  ```shell
  pnpm run test:e2e
  ```

## Development Logs

### init project

* init project

  ```shell
  pnpm i -g @nestjs/cli
  nest new callgent-api
  cd callgent-api
  ```

### add dependencies

### integrate prisma

* automatically setup the library, scripts and Docker files

  ```shell
  nest add nestjs-prisma
  ```

* integrate prisma plugins
* ReposModule
* init db

  ```shell
  npx prisma init
  ```

* create prisma schema, then init db

  ```shell
  npx prisma migrate dev --name init
  ```

### multi-tenancy

1. write default value for `tenancy.tenantPk` in db

  ```text
  tenantPk Int  @default(dbgenerated("(current_setting('tenancy.tenantPk'))::int"))
  ```

1. enable postgres row level security(RLS), so that we can filter data by `tenantPk` automatically:
   config in prisma/migrations/01_row_level_security/migration.sql,
   @see <https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security>

2. set `tenantPk` into `cls` context:

   ```ts
   cls.set('TENANT_ID', ..
   ```

3. extend `PrismaClient` to set `tenantPk` before any query

   ```sql
   SELECT set_config('tenancy.tenantPk', cls.get('TENANT_ID') ...
   ```

4. bypass rls, for example, by admin, or looking up the logon user to determine their tenant ID:

   ```sql
   CREATE POLICY bypass_rls_policy ON "User" USING (current_setting('tenancy.bypass_rls', TRUE)::text = 'on');
   ```

   then when you want to bypass rls, you must set `tenancy.bypass_rls` to `on` before running the query:

   ```js
   await prisma.$executeRaw`SELECT set_config('tenancy.bypass_rls', 'on', TRUE)`;
   ```

### Authentication

there is no account type, you may invite members to your account if you have permission.
TODO: you may set a mail host as default members.
you may bind many identities to your user, which is useful to access oauth provider resources,

#### jwt

all validation is based on bearer token, with payload:

  ```js
  {
    sub: user.pk.toString(),
    iss: user.tenantPk.toString(),
    aud: user.id,
  }
  ```

##### change `authorization` to `x-callgent-authorization` header

extract token from header:

```typescript
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // ExtractJwt.fromAuthHeaderAsBearerToken(), // For bearer token
        (request) => request?.headers['x-callgent-authorization'],
    })}
```

###### swagger support

1. config swagger

   ```typescript
    const config = new DocumentBuilder()
      // ...
      // .addBearerAuth(schema, 'defaultBearerAuth')
      .addSecurity('defaultBearerAuth', {
        type: 'apiKey',
        in: 'header',
        name: 'x-callgent-authorization',
      })
      .build();

   ```

2. set default token for API test

   ```typescript
   const devJwtToken = 'test-jwt-token';
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
   ```

3. On controller, change from `@ApiBearerAuth('defaultBearerAuth')` to `@ApiSecurity('defaultBearerAuth')`.  

#### local auth

login with email and password, TODO: email verification is required.

#### oauth client

need NOT scope to get user email:

* google: add '<https://www.googleapis.com/auth/userinfo.email>' scope on oauth screen <https://console.cloud.google.com/apis/credentials/consent/edit?hl=zh-cn&project=skilled-bonus-381610>
* github, contains email by default, <https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user>
* facebook?: add 'email' scope on oauth screen <https://developers.facebook.com/docs/facebook-login/permissions/overview>

##### to add a new oauth client

1. create a oauth client in 3rd party provider, e.g. github, get client id and secret
2. in `.env` add:

   ```config title=".env"
   `PROVIDER_KEY`_OAUTH_CLIENT_ID = 
   `PROVIDER_KEY`_OAUTH_CLIENT_SECRET = 
   ```

3. add provider config in `oauth-client.module.ts`
4. add user info retrieval logic in `AutLoginListener#retrieveUserInfoFromOauth()`
5. finally, `/api/auth/{PROVIDER_KEY}` is ready to use

### `EntityIdExists` validator

We defined a parameter validator `EntityIdExists` to check if an entity exists in the database.

#### Validation on DTO

You may annotate it to your DTO property like this:

```typescript
export class CreateTaskDto {
  // ...

  // automatically validation check if the callgent exists in db on controller requesting
  @EntityIdExists('callgent', 'id') // @EntityIdExists('entityType', 'fieldName')
  callgentId: string;
}
```

#### Validation on prisma generated DTO

Based on `prisma-generator-nestjs-dto`, you may also annotate this decorator in `schema.prisma` file:

```prisma
model Task {
  // ...
  /// @CustomValidator(EntityIdExists, 'callgent', 'id', ../../infra/repo/validators/entity-exists.validator)
  callgentId String @db.VarChar(36)
}
```

This makes the generated DTO to be annotated with `@EntityIdExists` decorator.

#### Retrieves the entity instance

This makes sure the `callgentId` field is a valid UUID of a callgent in the database.  
you can retrieve the entity instance directly from the dto:

```typescript
const callgent = EntityIdExists.entity<Callgent>(dto, 'callgentId') ||
          (await prisma.callgent.findUnique({ where: {id: dto.callgentId} }));
```
