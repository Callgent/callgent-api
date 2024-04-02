import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  await initTestData();
}

// execute the main function
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // close Prisma Client at the end
    await prisma.$disconnect();
  });

async function initTestData() {
  const tenant: Prisma.TenantUncheckedCreateInput = {
    id: 1,
    uuid: 'TEST_TENANT_UUID',
  };
  const tenantDto = await prisma.tenant.upsert({
    where: { id: 1 },
    update: tenant,
    create: tenant,
  });
  console.log({ tenantDto });

  const userUuid = 'TEST_USER_UUID';
  const u: Prisma.UserUncheckedCreateInput = {
    id: 1,
    uuid: userUuid,
    name: 'test-user',
    tenantId: 1,
  };
  const user = await prisma.user.upsert({
    where: { id: 1 },
    update: u,
    create: u,
  });
  const ui: Prisma.UserIdentityUncheckedCreateInput = {
    id: 1,
    tenantId: 1,
    provider: 'local',
    uid: 'test@botlet.io',
    // password123
    credentials: '$2b$10$KNpEa4ghz5PAS.wdI3lnu.dEjS8vyTkg1G287UoNjQWeDJr.qM3F.',
    name: 'test-user',
    email: 'test@botlet.io',
    email_verified: true,
    userUuid,
    userId: user.id,
  };
  (ui as any).id = 1;
  const userIdentity = await prisma.userIdentity.upsert({
    where: { id: 1 },
    update: ui,
    create: ui,
  });
  console.log({ userIdentity });

  const authTokenDto: Prisma.AuthTokenUncheckedCreateInput = {
    id: 1,
    token: 'TEST-ONLY-API_KEY',
    type: 'API_KEY',
    payload: {
      sub: userUuid,
      aud: 'appKey',
    },
  };
  const authToken = await prisma.authToken.upsert({
    where: { id: 1 },
    update: authTokenDto,
    create: authTokenDto,
  });
  console.log({ authToken });
}
