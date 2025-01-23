import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const myEnv = dotenv.config();
dotenvExpand.expand(myEnv);

async function main() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  return await prisma
    .$transaction(async (prisma) => {
      await prisma.$executeRaw`SELECT set_config('tenancy.bypass_rls', 'on', ${true})`;
      await Promise.all(initTestData(prisma));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      // close Prisma Client at the end
      await prisma.$disconnect();
    });
}

// execute the main function
main();

function initTestData(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) {
  const tenant: Prisma.TenantUncheckedCreateInput = {
    id: 'TEST_TENANT_ID',
    statusCode: 1,
  };

  const userId = 'TEST_USER_ID';
  const u: Prisma.UserUncheckedCreateInput = {
    id: userId,
    name: 'test-user',
    tenantPk: 1,
  };

  const ui: Prisma.UserIdentityUncheckedCreateInput = {
    tenantPk: 1,
    provider: 'local',
    uid: 'test@callgent.com',
    // Password123
    credentials: '$2b$10$JyBm6mzLb10z4SOH8Y6ZtOUwgNT6QSOGku/fILq8.uolQTvrRI4n.',
    name: 'test-user',
    email: 'test@callgent.com',
    email_verified: true,
    userPk: 1,
    userId,
  };

  const authTokenDto: Prisma.AuthTokenUncheckedCreateInput = {
    token: 'TEST-ONLY-API_KEY',
    type: 'API_KEY',
    payload: {
      sub: userId,
      aud: 'appKey',
    },
  };

  const callgentDto: Prisma.CallgentUncheckedCreateInput = {
    id: 'TEST_CALLGENT_ID',
    name: 'test-callgent',
    tenantPk: 1,
    createdBy: userId,
  };

  const callgentHubDto: Prisma.CallgentUncheckedCreateInput = {
    id: 'TEST_HUB_CALLGENT_ID',
    name: 'hub-callgent',
    tenantPk: -1,
    createdBy: userId,
  };

  const cepDto: Prisma.EntryUncheckedCreateInput = {
    id: 'TEST_CEP_ID',
    callgentId: 'TEST_CALLGENT_ID',
    type: 'CLIENT',
    adaptorKey: 'restAPI',
    host: '',
    tenantPk: 1,
    createdBy: userId,
  };

  const llmModel: Prisma.LlmModelPricingCreateInput = {
    pk: 1,
    modelName: 'deepseek-chat',
    price: {
      pricePerInputToken: 0.27,
      pricePerOutputToken: 1.1,
      pricePerCacheHitToken: 0.07,
      token: 1000000,
    },
    pricingMethod: 'calcPrice_deepseek',
  };

  return [
    prisma.tenant
      .upsert({
        where: { id: tenant.id },
        update: tenant,
        create: tenant,
      })
      .then(async (tenant) => {
        console.log({ tenant });
        await prisma.user
          .upsert({
            where: { id: u.id },
            update: u,
            create: u,
          })
          .then(async (user) => {
            (ui as any).userId = user.id;
            await prisma.userIdentity
              .upsert({
                where: { provider_uid: { provider: ui.provider, uid: ui.uid } },
                update: ui,
                create: ui,
              })
              .then((userIdentity) => console.log({ user, userIdentity }));
          });
      }),
    prisma.authToken
      .upsert({
        where: { token: authTokenDto.token },
        update: authTokenDto,
        create: authTokenDto,
      })
      .then((authToken) => console.log({ authToken })),
    prisma.callgent
      .upsert({
        where: { id: callgentHubDto.id },
        update: callgentHubDto,
        create: callgentHubDto,
      })
      .then((callgent) => console.log({ callgent })),
    prisma.callgent
      .upsert({
        where: { id: callgentDto.id },
        update: callgentDto,
        create: callgentDto,
      })
      .then((callgent) => console.log({ callgent })),
    prisma.entry
      .upsert({
        where: { id: cepDto.id },
        update: cepDto,
        create: cepDto,
      })
      .then((cep) => console.log({ cep })),
    prisma.llmModelPricing
      .upsert({
        where: { pk: llmModel.pk },
        update: llmModel,
        create: llmModel,
      })
      .then((llmModelPricing) => console.log({ llmModelPricing })),
    addLlmCache(
      prisma,
      'convert2Response',
      'Given the openAPI endpoint:\n{"endpoint": "GET /positions", "summary":"listPositions: List all job positions", "description":"Retrieve a list of all available job positions.", "params":{}, "responses":{"200":{"description":"A list of job positions","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Unique identifier for the job position"},"title":{"type":"string","description":"Title of the job position"},"description":{"type":"string","description":"Description of the job position"},"location":{"type":"string","description":"Location of the job position"},"requirements":{"type":"array","items":{"type":"string"},"description":"List of requirements for the job position"},"createdAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was created"},"updatedAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was last updated"}}}}}}},"500":{"description":"Internal Server Error"}} }\n\ninvoked with the following request:\n<--- request begin ---\n[]\n--- request end --->\n\nwe receive below response content:\n<--- response begin ---\nWe are pleased to inform you about the following job positions available at our company:\r\n\r\n1. Software Engineer\r\n   - Description: Develop and maintain software applications.\r\n   - Location: San Francisco, CA\r\n   - Requirements:\r\n     - Bachelor\'s degree in Computer Science or related field\r\n     - 3+ years of experience in software development\r\n     - Proficient in Java or Python\r\n   - Created At: October 1, 2023, 12:00 PM\r\n   - Updated At: October 1, 2023, 12:00 PM\r\n\r\n2. Product Manager\r\n   - Description: Define product strategy and roadmap.\r\n   - Location: New York, NY\r\n   - Requirements:\r\n     - Bachelor\'s degree in Business or related field\r\n     - 5+ years of experience in product management\r\n     - Strong analytical and problem-solving skills\r\n   - Created At: October 2, 2023, 10:00 AM\r\n   - Updated At: October 2, 2023, 10:00 AM\r\n\r\n3. Data Scientist\r\n   - Description: Analyze and interpret complex data to assist in decision-making.\r\n   - Location: Seattle, WA\r\n   - Requirements:\r\n     - Master\'s degree in Data Science or related field\r\n     - 2+ years of experience in data analysis\r\n     - Proficient in Python and SQL\r\n   - Created At: October 3, 2023, 8:00 AM\r\n   - Updated At: October 3, 2023, 8:00 AM\r\n\r\nPlease review the details and let us know if you are interested in any of these positions.\r\n\r\nBest regards\r\n> From: "Callgent Invoker"<request+xy5wgrpph-jn2hhn4_ali@mytest.callgent.com>\r\n> Date:  Thu, Sep 5, 2024, 14:44\r\n> Subject:  [Callgent] Function calling: \'GET /positions\' from Callgent test-callgent. #xY5WGrPph-jn2HHn4_aLi\r\n> To: "dev"<dev@callgent.com>\r\n> [image: https://hgggdgi.r.bh.d.sendibt3.com/tr/op/CYIv2yvoVWHCvjQ__eO-QxCY-FkqVvmIPWtQz6OMpAh55LRbe8vKq9aHSdoB0TikwlnXx5U6VsnDPf9637MS7iqb_BpOIcAej4CvQCx2hCA2upHiNg6mXVisqoSvihA0UM9ymGtL9RJsmgdosYMyVW2iHwS9m9UcLtnagkPE-HXmIE8L4EkAApInhajwSZuVsine_ltWzXmBzfU9jp6e5g]\r\n> Hello dev!\r\n> Somebody is calling: \'GET /positions\' from Callgent test-callgent. Below is the detailed request information:\r\n> Function Calling:\r\n> Name:GET /positions\r\n> Summary:listPositions: List all job positions\r\n> Description:Retrieve a list of all available job positions.\r\n> Possible Responses:\r\n> Response OK:A list of job positions\r\n> [{"id":"Unique identifier for the job position","title":"Title of the job position","description":"Description of the job position","location":"Location of the job position","requirements":["string"],"createdAt":"format: date-time, Timestamp when the job position was created","updatedAt":"format: date-time, Timestamp when the job position was last updated"}]\r\n> Response Internal Server Error:Internal Server Error\r\n> \r\n> \r\n> Thu, 05 Sep 2024 06:44:13 GMT\r\n\n--- response end --->\n\nPlease formalize the response content as a single-lined JSON object:\n{"statusCode": "the exact response code(integer) defined in API", "data": "extracted response value with respect to the corresponding API response schema, or undefined if abnormal response", "error": "message": "error message if abnormal response, otherwise undefined"}',
      '{\n  "statusCode": 200,\n  "data": [\n    {\n      "id": "1",\n      "title": "Software Engineer",\n      "description": "Develop and maintain software applications.",\n      "location": "San Francisco, CA",\n      "requirements": [\n        "Bachelor\'s degree in Computer Science or related field",\n        "3+ years of experience in software development",\n        "Proficient in Java or Python"\n      ],\n      "createdAt": "2023-10-01T12:00:00Z",\n      "updatedAt": "2023-10-01T12:00:00Z"\n    },\n    {\n      "id": "2",\n      "title": "Product Manager",\n      "description": "Define product strategy and roadmap.",\n      "location": "New York, NY",\n      "requirements": [\n        "Bachelor\'s degree in Business or related field",\n        "5+ years of experience in product management",\n        "Strong analytical and problem-solving skills"\n      ],\n      "createdAt": "2023-10-02T10:00:00Z",\n      "updatedAt": "2023-10-02T10:00:00Z"\n    },\n    {\n      "id": "3",\n      "title": "Data Scientist",\n      "description": "Analyze and interpret complex data to assist in decision-making.",\n      "location": "Seattle, WA",\n      "requirements": [\n        "Master\'s degree in Data Science or related field",\n        "2+ years of experience in data analysis",\n        "Proficient in Python and SQL"\n      ],\n      "createdAt": "2023-10-03T08:00:00Z",\n      "updatedAt": "2023-10-03T08:00:00Z"\n    }\n  ]\n}',
    ),
  ];
}

async function addLlmCache(
  prisma,
  name: string,
  prompt: string,
  result: string,
) {
  const llmCacheDto = { name, prompt, result };
  const model = 'meta-llama/llama-3.1-70b-instruct:free';

  const ret = await prisma.llmCache.findFirst({
    where: { prompt, model, name },
    select: { pk: true },
  });

  return (
    ret?.pk
      ? prisma.llmCache.update({
          where: { pk: ret.pk },
          data: llmCacheDto,
        })
      : prisma.llmCache.create({ data: { name, model, prompt, result } })
  ).then((lmCache) => console.log({ lmCache }));
}
