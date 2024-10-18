import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

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
    // password123
    credentials: '$2b$10$JmQ5gwQevEGI6t.HLrCw3ugQNf9.8KaqC1OaaC5mCMClii.zKveYm',
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
    // addLlmCache(
    //   prisma,
    //   'map2Endpoints',
    //   'given below service endpoints:\nclass new-test-callgent {\n  "POST:/boards/list": {"params":[invoker,apiKey], "documents":"This function lists all boards.\n\n@param {Function} invoker - A function that makes the actual API call.\n@param {string} apiKey - Your secret API key.\n\n@returns {Promise<Object>} A promise that resolves to an object containing the API result.\n@property {Array<Object>} boards - An array of board objects.\n@property {string} boards[].id - A unique identifier for the board.\n@property {string} boards[].created - Time at which the board was created, in ISO 8601 format.\n@property {boolean} boards[].isPrivate - Whether or not the board is set as private in the administrative settings.\n@property {string} boards[].name - The board\'s name.\n@property {number} boards[].postCount - The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete.\n@property {boolean} boards[].privateComments - Whether or not comments left on posts can be viewed by other end-users.\n@property {string} boards[].url - The URL to the board\'s page.\n@property {boolean} hasMore - Specifies whether this query returns more boards than the limit."},\n\n}\nand an service `invoker` function.\n\nPlease choose relevant endpoints to fulfill below request:\n{\n"requesting function": "POST:/boards/list",\n"request from": "restAPI",\n"request_object": {"url":"/boards/list","method":"POST","headers":{"host":"127.0.0.1:3300","connection":"close","content-length":"0"},"query":{}},\n}\nand code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.\n\noutput a single-line json object:\n{ "epName": "the endpoint name to be invoked", "params":"param names of the chosen function", "mapping": "the js function (invoker, request_object)=>{...;return functionArgsArray;}, full implementation to return the **real** args from request_object to invoke the chosen service function. don\'t use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}',
    //   '{"endpoint":"POST:/boards/list","args":["invoker","apiKey"],"mapping":"(invoker, request_object)=>{ let apiKey = request_object.params.ids; return [invoker, apiKey]; }","question":"What is the API key for this request? It is not provided in the request_object."}',
    // ),
    // addLlmCache(
    //   prisma,
    //   'map2Endpoints',
    //   'given below service endpoints:\nservice test-callgent {\n  "GET /positions": {"summary":"listPositions: List all job positions", "description":"Retrieve a list of all available job positions.", "params":{}, "responses":{"200":{"description":"A list of job positions","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Unique identifier for the job position"},"title":{"type":"string","description":"Title of the job position"},"description":{"type":"string","description":"Description of the job position"},"location":{"type":"string","description":"Location of the job position"},"requirements":{"type":"array","items":{"type":"string"},"description":"List of requirements for the job position"},"createdAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was created"},"updatedAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was last updated"}}}}}}},"500":{"description":"Internal Server Error"}} },\n}\n\nPlease choose relevant endpoints to fulfill below request:\n{\n"requesting endpoint": "GET /positions",\n"request from": "restAPI",\n"request_object": {"url":"/positions","method":"GET","headers":{"accept":"*/*","accept-encoding":"gzip, deflate, br","cache-control":"no-cache","connection":"keep-alive","host":"127.0.0.1:3000","user-agent":"Apifox/1.0.0 (https://apifox.com)"},"query":{}},\n}\nand code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.\n\noutput a single-line json object:\n{ "endpoint": "the chosen API endpoint to be invoked", "args":"params/body/headers/..., with same structure as the \'params\' JSON object(no more args than it) with additional \'value\' prop, or null if no args needed", "mapping": "if the the request_object is structured (or null if unstructured), generate the js function (request_object)=>{...;return API_signature_args;}, full implementation to return the **real** args from request_object to invoke the API. don\'t use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}',
    //   '{ "endpoint": "GET /positions", "args": null, "mapping": "(request_object)=>{return null;}", "question": null }',
    // ),
    // addLlmCache(
    //   prisma,
    //   'map2Endpoints',
    //   'given below service endpoints:\nservice test-callgent {\n  "POST /api/users/send-confirm-email": {"summary":"UsersController_sendConfirmEmail: Reset password by sending validation email with reset url", "description":" Tags: Users", "params":{"parameters":[],"requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"email":{"type":"string","example":"user@example.com","nullable":false},"create":{"type":"boolean","description":"If true, a new user will be created if not exists.","nullable":true},"resetPwd":{"type":"boolean","description":"If set to false, only validating email. Note: new user forces resetPwd.","nullable":true}},"required":["email"]}}}}}, "responses":{"201":{"description":"","content":{"application/json":{"schema":{"allOf":[{"type":"object","properties":{"statusCode":{"type":"number","description":"Status code, empty means success"},"message":{"type":"string"},"data":{"type":"object"},"meta":{"type":"object","description":"Pagination, usage, quotation, profiling, versions, HATEOAS, etc."}},"required":["data"]},{"properties":{"data":{"type":"boolean"}}}]}}}}} },\n}\n\nPlease choose relevant endpoints to fulfill below request:\n{\n"requesting endpoint": "POST /api/users/send-confirm-email",\n"request from": "restAPI",\n"request_object": {"url":"/api/users/send-confirm-email","method":"POST","headers":{"accept":"*/*","accept-encoding":"gzip, deflate, br","cache-control":"no-cache","connection":"keep-alive","content-length":"53","content-type":"application/json","host":"127.0.0.1:3000","user-agent":"Apifox/1.0.0 (https://apifox.com)"},"params":{},"data":{"email":"dev@callgent.com","resetPwd":true}},\n}\nand code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.\n\noutput a single-line json object:\n{ "endpoint": "the chosen API endpoint to be invoked", "args":"params/body/headers/..., with same structure as the \'params\' JSON object(no more args than it) with additional \'value\' prop, or null if no args needed", "mapping": "if the the request_object is structured (or null if unstructured), generate the js function (request_object)=>{...;return API_signature_args;}, full implementation to return the **real** args from request_object to invoke the API. don\'t use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}',
    //   '```json\n{\n  "endpoint": "POST /api/users/send-confirm-email",\n  "args": {\n    "params": null,\n    "body": {\n      "email": { "value": "dev@callgent.com" },\n      "resetPwd": { "value": true }\n    },\n    "headers": null\n  },\n  "mapping": "(request_object) => {\n    const { data } = request_object;\n    return {\n      body: {\n        email: { value: data.email },\n        resetPwd: { value: data.resetPwd }\n      }\n    };\n  }",\n  "question": null\n}\n```',
    // ),
    // addLlmCache(
    //   prisma,
    //   'map2Endpoints',
    //   'given below service endpoints:\nservice test-callgent {\n  "POST /api/users/send-confirm-email": {"summary":"UsersController_sendConfirmEmail: Reset password by sending validation email with reset url", "description":" Tags: Users", "params":{"parameters":[],"requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"email":{"type":"string","example":"user@example.com","nullable":false},"create":{"type":"boolean","description":"If true, a new user will be created if not exists.","nullable":true},"resetPwd":{"type":"boolean","description":"If set to false, only validating email. Note: new user forces resetPwd.","nullable":true}},"required":["email"]}}}}}, "responses":{"201":{"description":"","content":{"application/json":{"schema":{"allOf":[{"type":"object","properties":{"statusCode":{"type":"number","description":"Status code, empty means success"},"message":{"type":"string"},"data":{"type":"object"},"meta":{"type":"object","description":"Pagination, usage, quotation, profiling, versions, HATEOAS, etc."}},"required":["data"]},{"properties":{"data":{"type":"boolean"}}}]}}}}} },\n}\n\nPlease choose relevant endpoints to fulfill below request:\n{\n"requesting endpoint": "POST /api/users/send-confirm-email",\n"request from": "restAPI",\n"request_object": {"url":"/api/users/send-confirm-email","method":"POST","headers":{"accept":"*/*","accept-encoding":"gzip, deflate, br","connection":"keep-alive","content-length":"53","content-type":"application/json","host":"127.0.0.1:3000","user-agent":"Apifox/1.0.0 (https://apifox.com)"},"params":{},"data":{"email":"dev@callgent.com","resetPwd":true}},\n}\nand code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.\n\noutput a single-line json object:\n{ "endpoint": "the chosen API endpoint to be invoked", "args":"params/body/headers/..., with same structure as the \'params\' JSON object(no more args than it) with additional \'value\' prop, or null if no args needed", "mapping": "if the the request_object is structured (or null if unstructured), generate the js function (request_object)=>{...;return API_signature_args;}, full implementation to return the **real** args from request_object to invoke the API. don\'t use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}',
    //   '```json\n{\n  "endpoint": "POST /api/users/send-confirm-email",\n  "args": {\n    "params": null,\n    "body": {\n      "email": { "value": "dev@callgent.com" },\n      "resetPwd": { "value": true }\n    },\n    "headers": null\n  },\n  "mapping": "(request_object) => {\n    const { data } = request_object;\n    return {\n      body: {\n        email: { value: data.email },\n        resetPwd: { value: data.resetPwd }\n      }\n    };\n  }",\n  "question": null\n}\n```',
    // ),
    // addLlmCache(
    //   prisma,
    //   'convert2Response',
    //   'Given the openAPI endpoint:\n{"endpoint": "GET /positions", "summary":"listPositions: List all job positions", "description":"Retrieve a list of all available job positions.", "params":{}, "responses":{"200":{"description":"A list of job positions","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Unique identifier for the job position"},"title":{"type":"string","description":"Title of the job position"},"description":{"type":"string","description":"Description of the job position"},"location":{"type":"string","description":"Location of the job position"},"requirements":{"type":"array","items":{"type":"string"},"description":"List of requirements for the job position"},"createdAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was created"},"updatedAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was last updated"}}}}}}},"500":{"description":"Internal Server Error"}} }\n\ninvoked with the following request:\n<--- request begin ---\n[]\n--- request end --->\n\nwe receive below response content:\n<--- response begin ---\nWe are pleased to inform you about the following job positions available at our company:\r\n\r\n1. Software Engineer\r\n   - Description: Develop and maintain software applications.\r\n   - Location: San Francisco, CA\r\n   - Requirements:\r\n     - Bachelor\'s degree in Computer Science or related field\r\n     - 3+ years of experience in software development\r\n     - Proficient in Java or Python\r\n   - Created At: October 1, 2023, 12:00 PM\r\n   - Updated At: October 1, 2023, 12:00 PM\r\n\r\n2. Product Manager\r\n   - Description: Define product strategy and roadmap.\r\n   - Location: New York, NY\r\n   - Requirements:\r\n     - Bachelor\'s degree in Business or related field\r\n     - 5+ years of experience in product management\r\n     - Strong analytical and problem-solving skills\r\n   - Created At: October 2, 2023, 10:00 AM\r\n   - Updated At: October 2, 2023, 10:00 AM\r\n\r\n3. Data Scientist\r\n   - Description: Analyze and interpret complex data to assist in decision-making.\r\n   - Location: Seattle, WA\r\n   - Requirements:\r\n     - Master\'s degree in Data Science or related field\r\n     - 2+ years of experience in data analysis\r\n     - Proficient in Python and SQL\r\n   - Created At: October 3, 2023, 8:00 AM\r\n   - Updated At: October 3, 2023, 8:00 AM\r\n\r\nPlease review the details and let us know if you are interested in any of these positions.\r\n\r\nBest regards\r\n> From: "Callgent Invoker"<request+xy5wgrpph-jn2hhn4_ali@mytest.callgent.com>\r\n> Date:  Thu, Sep 5, 2024, 14:44\r\n> Subject:  [Callgent] Function calling: \'GET /positions\' from Callgent test-callgent. #xY5WGrPph-jn2HHn4_aLi\r\n> To: "dev"<dev@callgent.com>\r\n> [image: https://hgggdgi.r.bh.d.sendibt3.com/tr/op/CYIv2yvoVWHCvjQ__eO-QxCY-FkqVvmIPWtQz6OMpAh55LRbe8vKq9aHSdoB0TikwlnXx5U6VsnDPf9637MS7iqb_BpOIcAej4CvQCx2hCA2upHiNg6mXVisqoSvihA0UM9ymGtL9RJsmgdosYMyVW2iHwS9m9UcLtnagkPE-HXmIE8L4EkAApInhajwSZuVsine_ltWzXmBzfU9jp6e5g]\r\n> Hello dev!\r\n> Somebody is calling: \'GET /positions\' from Callgent test-callgent. Below is the detailed request information:\r\n> Function Calling:\r\n> Name:GET /positions\r\n> Summary:listPositions: List all job positions\r\n> Description:Retrieve a list of all available job positions.\r\n> Possible Responses:\r\n> Response OK:A list of job positions\r\n> [{"id":"Unique identifier for the job position","title":"Title of the job position","description":"Description of the job position","location":"Location of the job position","requirements":["string"],"createdAt":"format: date-time, Timestamp when the job position was created","updatedAt":"format: date-time, Timestamp when the job position was last updated"}]\r\n> Response Internal Server Error:Internal Server Error\r\n> \r\n> \r\n> Thu, 05 Sep 2024 06:44:13 GMT\r\n\n--- response end --->\n\nPlease formalize the response content as a single-lined JSON object:\n{"statusCode": "the exact response code(integer) defined in API", "data": "extracted response value with respect to the corresponding API response schema, or undefined if abnormal response", "error": "message": "error message if abnormal response, otherwise undefined"}',
    //   '{\n  "statusCode": 200,\n  "data": [\n    {\n      "id": "1",\n      "title": "Software Engineer",\n      "description": "Develop and maintain software applications.",\n      "location": "San Francisco, CA",\n      "requirements": [\n        "Bachelor\'s degree in Computer Science or related field",\n        "3+ years of experience in software development",\n        "Proficient in Java or Python"\n      ],\n      "createdAt": "2023-10-01T12:00:00Z",\n      "updatedAt": "2023-10-01T12:00:00Z"\n    },\n    {\n      "id": "2",\n      "title": "Product Manager",\n      "description": "Define product strategy and roadmap.",\n      "location": "New York, NY",\n      "requirements": [\n        "Bachelor\'s degree in Business or related field",\n        "5+ years of experience in product management",\n        "Strong analytical and problem-solving skills"\n      ],\n      "createdAt": "2023-10-02T10:00:00Z",\n      "updatedAt": "2023-10-02T10:00:00Z"\n    },\n    {\n      "id": "3",\n      "title": "Data Scientist",\n      "description": "Analyze and interpret complex data to assist in decision-making.",\n      "location": "Seattle, WA",\n      "requirements": [\n        "Master\'s degree in Data Science or related field",\n        "2+ years of experience in data analysis",\n        "Proficient in Python and SQL"\n      ],\n      "createdAt": "2023-10-03T08:00:00Z",\n      "updatedAt": "2023-10-03T08:00:00Z"\n    }\n  ]\n}',
    // ),
  ];
}

async function addLlmCache(
  prisma,
  name: string,
  prompt: string,
  result: string,
) {
  const llmCacheDto = { name, prompt, result };
  return prisma.llmCache
    .upsert({
      where: { prompt_name: { name, prompt } },
      update: llmCacheDto,
      create: llmCacheDto,
    })
    .then((lmCache) => console.log({ lmCache }));
}
