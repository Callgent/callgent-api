# Developer Guide

## Development Setup

- copy `.env.dev` to `.env`
- install postgres with vector plugin

    ```shell
    docker pull ankane/pgvector
    ```

- init db

    ```shell
    npx prisma generate # generate PrismaClient
    npx prisma migrate dev # init db schema
    npx prisma db seed # init db data
    ```

- start server

  ```shell
  pnpm run start:dev
  ```

## Development Logs

### init project

- init project

    ```shell
    pnpm i -g @nestjs/cli
    nest new botlet-api
    cd botlet-api
    ```

### add dependencies

### integrate prisma

- automatically setup the library, scripts and Docker files

    ```shell
    nest add nestjs-prisma
    ```

- integrate prisma plugins
- ReposModule
- init db

    ```shell
    npx prisma init
    ```

- create prisma schema, then init db

    ```shell
    npx prisma migrate dev --name init
    ```

### multi-tenancy

1. write default value for `tenancy.tenantId` in db

   ```text
   tenantId Int  @default(dbgenerated("(current_setting('tenancy.tenantId'))::int"))
   ```

2. enable postgres row level security(RLS), so that we can filter data by `tenantId` automatically:
   config in prisma/migrations/01_row_level_security/migration.sql,
   @see <https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security>

3. set `tenantId` into `cls` context:

   ```ts
   cls.set('TENANT_ID', ..
   ```

4. extend `PrismaClient` to set `tenantId` before any query

   ```sql
   SELECT set_config('tenancy.tenantId', cls.get('TENANT_ID') ...
   ```

5. bypass rls, for example, by admin, or looking up the logon user to determine their tenant ID:

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
    sub: user.id.toString(),
    iss: user.tenantId.toString(),
    aud: user.uuid,
  }
  ```

#### local auth

login with email and password, TODO: email verification is required.

#### oauth client

need NOT scope to get user email:

- google: add 'https://www.googleapis.com/auth/userinfo.email' scope on oauth screen <https://console.cloud.google.com/apis/credentials/consent/edit?hl=zh-cn&project=skilled-bonus-381610>
- github, contains email by default, <https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28#get-the-authenticated-user>
- facebook?: add 'email' scope on oauth screen <https://developers.facebook.com/docs/facebook-login/permissions/overview>

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
