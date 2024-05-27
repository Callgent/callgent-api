import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  const promises = [];
  promises.push(...initData());
  if (process.env.SEED_TEST_DATA) promises.push(...initTestData());
  return Promise.all(promises);
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

function initData() {
  return [...initEventListeners(), initLlmTemplates()];
}

function initEventListeners() {
  let elId = 1,
    priority = -100;
  const els: Prisma.EventListenerUncheckedCreateInput[] = [
    {
      id: elId++,
      uuid: 'CR-ADAPTOR-PREPROCESS',
      srcUuid: 'GLOBAL',
      tenantId: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EndpointsService',
      funName: 'preprocessClientRequest',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: elId++,
      uuid: 'CR-LOAD-FUNCTIONS',
      srcUuid: 'GLOBAL',
      tenantId: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'CallgentFunctionsService',
      funName: 'loadFunctions',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: elId++,
      uuid: 'CR-LOAD-TARGET',
      srcUuid: 'GLOBAL',
      tenantId: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EventStoresService',
      funName: 'loadTargetEvents',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: elId++,
      uuid: 'CR-MAP-2-FUNCTION',
      srcUuid: 'GLOBAL',
      tenantId: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'AgentsService',
      funName: 'map2Function',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: elId++,
      uuid: 'CR-MAP-2-ARGS',
      srcUuid: 'GLOBAL',
      tenantId: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'SandBoxService',
      funName: 'map2Args',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    // {
    //   id: elId++,
    //   uuid: 'PR-MAP-2-ARGS',
    //   srcUuid: 'GLOBAL',
    //   tenantId: 0,
    //   eventType: 'CLIENT_REQUEST',
    //   dataType: '*',
    //   serviceType: 'SERVICE',
    //   serviceName: 'SandBoxService',
    //   funName: 'map2Args',
    //   createdBy: 'GLOBAL',
    //   priority: (priority = 0),
    // },
  ];

  return els.map((el) =>
    prisma.eventListener
      .upsert({
        where: { id: el.id },
        update: el,
        create: el,
      })
      .then((el) => console.log(el)),
  );
}

async function initLlmTemplates() {
  const llmTemplates: Prisma.LlmTemplateUncheckedCreateInput[] = [
    {
      id: 1,
      name: 'api2Function',
      prompt: `Please convert below API doc of format {{=it.format}}:
{ "{{=it.apiName}}": {{=it.apiContent}} }

into a js function, the function must be as follows:
// the \`invoker\` function do the real invocation
async (invoker: {{=it.handle}}, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }

please generate the js function with **full implementation and error handling**! output a single-line json object:
{"funName":"function name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}`,
    },
    {
      id: 2,
      name: 'map2Function',
      prompt: `given below service functions:
class {{=it.callgentName}} {{{~ it.callgentFunctions :fun }}
  "function name: {{=fun.name}}": {"params":[{{=fun.params}}], "documents":"{{=fun.documents}}"},
{{~}}
}
and an service \`invoker\` function.

Please choose one function to fulfill below request:
{
{{ if (it.funName) { }}"requesting function": "{{=it.funName}}",
{{ } }}"request from": "{{=it.cepAdaptor}}",
"request_object": {{=JSON.stringify(it.req)}},
}
and code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.

output a single-line json object:
{ "funName": "the function name to be invoked", "params":"param names of the chosen function", "mapping": "the js function (invoker, request_object)=>{...;return functionArgsArray;}, full implementation to return the **real** args from request_object to invoke the chosen service function. don't use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}`,
    },
  ];

  return llmTemplates.map((llmTpl) =>
    prisma.llmTemplate
      .upsert({
        where: { id: llmTpl.id },
        update: llmTpl,
        create: llmTpl,
      })
      .then((llmTpl) => console.log({ llmTpl })),
  );
}

function initTestData() {
  const tenant: Prisma.TenantUncheckedCreateInput = {
    id: 1,
    uuid: 'TEST_TENANT_UUID',
    statusCode: 1,
  };

  const userUuid = 'TEST_USER_UUID';
  const u: Prisma.UserUncheckedCreateInput = {
    id: 1,
    uuid: userUuid,
    name: 'test-user',
    tenantId: 1,
  };

  const ui: Prisma.UserIdentityUncheckedCreateInput = {
    id: 1,
    tenantId: 1,
    provider: 'local',
    uid: 'test@callgent.com',
    // password123
    credentials: '$2b$10$JmQ5gwQevEGI6t.HLrCw3ugQNf9.8KaqC1OaaC5mCMClii.zKveYm',
    name: 'test-user',
    email: 'test@callgent.com',
    email_verified: true,
    userId: 1,
    userUuid,
  };

  const authTokenDto: Prisma.AuthTokenUncheckedCreateInput = {
    id: 1,
    token: 'TEST-ONLY-API_KEY',
    type: 'API_KEY',
    payload: {
      sub: userUuid,
      aud: 'appKey',
    },
  };

  const callgentDto: Prisma.CallgentUncheckedCreateInput = {
    id: 1,
    uuid: 'TEST_CALLGENT_UUID',
    name: 'test-callgent',
    tenantId: 1,
    createdBy: userUuid,
  };

  const cepDto: Prisma.EndpointUncheckedCreateInput = {
    id: 1,
    uuid: 'TEST_CEP_UUID',
    callgentUuid: 'TEST_CALLGENT_UUID',
    type: 'CLIENT',
    adaptorKey: 'restAPI',
    host: {},
    tenantId: 1,
    createdBy: userUuid,
  };

  return [
    prisma.tenant
      .upsert({
        where: { id: 1 },
        update: tenant,
        create: tenant,
      })
      .then((tenant) => {
        console.log({ tenant });
        prisma.user
          .upsert({
            where: { id: 1 },
            update: u,
            create: u,
          })
          .then((user) => {
            (ui as any).id = 1;
            (ui as any).userId = user.id;
            prisma.userIdentity
              .upsert({
                where: { id: 1 },
                update: ui,
                create: ui,
              })
              .then((userIdentity) => console.log({ user, userIdentity }));
          });
      }),
    prisma.authToken
      .upsert({
        where: { id: 1 },
        update: authTokenDto,
        create: authTokenDto,
      })
      .then((authToken) => console.log({ authToken })),
    prisma.callgent
      .upsert({
        where: { id: 1 },
        update: callgentDto,
        create: callgentDto,
      })
      .then((callgent) => console.log({ callgent })),
    prisma.endpoint
      .upsert({
        where: { id: 1 },
        update: cepDto,
        create: cepDto,
      })
      .then((cep) => console.log({ cep })),
    addLlmCache(
      1,
      'api2Function',
      'Please convert below API doc of format restAPI:\n{ "POST:/boards/list": {"summary":"List all boards","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"apiKey":{"type":"string","description":"Your secret API key."}},"required":["apiKey"]}}},"required":true},"responses":{"200":{"description":"A dictionary with a \\"boards\\" property that contains an array of board objects.","content":{"application/json":{"schema":{"type":"object","properties":{"boards":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the board."},"created":{"type":"string","description":"Time at which the board was created, in ISO 8601 format."},"isPrivate":{"type":"boolean","description":"Whether or not the board is set as private in the administrative settings."},"name":{"type":"string","description":"The board\'s name."},"postCount":{"type":"integer","description":"The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete."},"privateComments":{"type":"boolean","description":"Whether or not comments left on posts can be viewed by other end-users."},"url":{"type":"string","description":"The URL to the board\'s page."}}}},"hasMore":{"type":"boolean","description":"Specifies whether this query returns more boards than the limit."}}}}}}}} }\n\ninto a js function, the function must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }\n\nplease generate the js function with **full implementation and error handling**! output a single-line json object:\n{"funName":"function name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}',
      '{"funName":"listBoards","params":["invoker","apiKey"],"documents":"This function lists all boards.\\n\\n@param {Function} invoker - A function that makes the actual API call.\\n@param {string} apiKey - Your secret API key.\\n\\n@returns {Promise<Object>} A promise that resolves to an object containing the API result.\\n@property {Array<Object>} boards - An array of board objects.\\n@property {string} boards[].id - A unique identifier for the board.\\n@property {string} boards[].created - Time at which the board was created, in ISO 8601 format.\\n@property {boolean} boards[].isPrivate - Whether or not the board is set as private in the administrative settings.\\n@property {string} boards[].name - The board\'s name.\\n@property {number} boards[].postCount - The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete.\\n@property {boolean} boards[].privateComments - Whether or not comments left on posts can be viewed by other end-users.\\n@property {string} boards[].url - The URL to the board\'s page.\\n@property {boolean} hasMore - Specifies whether this query returns more boards than the limit.","fullCode":"(invoker, apiKey) => {\\n  const requestBody = {\\n    apiKey\\n  };\\n  const options = {\\n    method: \'POST\',\\n    path: \'/boards/list\',\\n    body: JSON.stringify(requestBody),\\n    headers: {\'Content-Type\': \'application/json\'},\\n  };\\n  try {\\n    const json = await invoker(options);\\n    if (json.status !== 200) {\\n      throw new Error(Request failed with status ${json.status});\\n    }\\n    return json.apiResult;\\n  } catch (error) {\\n    console.error(error);\\n    throw error;\\n  }\\n}"}',
    ),
    addLlmCache(
      2,
      'api2Function',
      'Please convert below API doc of format restAPI:\n{ "POST:/boards/retrieve": {"summary":"Retrieve board","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"apiKey":{"type":"string","description":"Your secret API key."},"id":{"type":"string","description":"The board\'s unique identifier."}},"required":["apiKey","id"]}}},"required":true},"responses":{"200":{"description":"Returns a board object, if a valid id was supplied.","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the board."},"created":{"type":"string","description":"Time at which the board was created, in ISO 8601 format."},"isPrivate":{"type":"boolean","description":"Whether or not the board is set as private in the administrative settings."},"name":{"type":"string","description":"The board\'s name."},"postCount":{"type":"integer","description":"The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete."},"privateComments":{"type":"boolean","description":"Whether or not comments left on posts can be viewed by other end-users."},"url":{"type":"string","description":"The URL to the board\'s page."}}}}}}}} }\n\ninto a js function, the function must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }\n\nplease generate the js function with **full implementation and error handling**! output a single-line json object:\n{"funName":"function name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}',
      '{"funName":"retrieveBoard","params":["invoker","apiKey","id"],"documents":"This function retrieves a board object given a valid API key and board ID.\\n\\nParameters:\\n- invoker: A function that performs the actual API call.\\n- apiKey: Your secret API key.\\n- id: The board\'s unique identifier.\\n\\nReturns:\\nAn object containing the board details if a valid id was supplied. The object properties are:\\n- id: A unique identifier for the board.\\n- created: Time at which the board was created, in ISO 8601 format.\\n- isPrivate: Whether or not the board is set as private in the administrative settings.\\n- name: The board\'s name.\\n- postCount: The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete.\\n- privateComments: Whether or not comments left on posts can be viewed by other end-users.\\n- url: The URL to the board\'s page.","fullCode":"(invoker, apiKey, id) => {\\n  const req = {\\n    path: \'/boards/retrieve\',\\n    method: \'POST\',\\n    headers: { \'Content-Type\': \'application/json\' },\\n    body: JSON.stringify({\\n      apiKey, id\\n    })\\n  };\\n  try {\\n    const resp = await invoker(req);\\n    if (resp.status !== 200) {\\n      throw new Error(`Failed to retrieve board. Status: ${resp.status}`);\\n    }\\n    return resp.result;\\n  } catch (error) {\\n    console.error(error);\\n    throw error;\\n  }\\n}"}',
    ),
    addLlmCache(
      3,
      'api2Function',
      'Please convert below API doc of format restAPI:\n{ "POST:/categories/list": {"summary":"List categories","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"apiKey":{"type":"string","description":"Your secret API key."},"boardID":{"type":"string","description":"The id of the board you\'d like to fetch categories for."},"limit":{"type":"integer","description":"The number of categories you\'d like to fetch. Defaults to 10 if not specified. Max of 10000."},"skip":{"type":"integer","description":"The number of categories you\'d like to skip before starting to fetch. Defaults to 0 if not specified."}},"required":["apiKey"]}}},"required":true},"responses":{"200":{"description":"A dictionary with a \\"categories\\" property that contains an array of tag objects. There\'s also a \\"hasMore\\" property that specifies whether this query returns more categories than the limit.","content":{"application/json":{"schema":{"type":"object","properties":{"categories":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the category."},"board":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the board."},"created":{"type":"string","description":"Time at which the board was created, in ISO 8601 format."},"isPrivate":{"type":"boolean","description":"Whether or not the board is set as private in the administrative settings."},"name":{"type":"string","description":"The board\'s name."},"postCount":{"type":"integer","description":"The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete."},"privateComments":{"type":"boolean","description":"Whether or not comments left on posts can be viewed by other end-users."},"url":{"type":"string","description":"The URL to the board\'s page."}},"description":"The board this category is associated with."},"created":{"type":"string","description":"Time at which the category was created, in ISO 8601 format."},"name":{"type":"string","description":"The name of the category."},"parentID":{"type":"string","description":"The id of the parent category. If this category is not a sub category, this field will be null."},"postCount":{"type":"integer","description":"The number of posts that have been assigned this category."},"url":{"type":"string","description":"The URL to the board, filtered to just posts that have been assigned this category."}}}},"hasMore":{"type":"boolean","description":"Specifies whether this query returns more categories than the limit."}}}}}}}} }\n\ninto a js function, the function must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }\n\nplease generate the js function with **full implementation and error handling**! output a single-line json object:\n{"funName":"function name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}',
      '{"funName":"listCategories","params":["invoker","apiKey","boardID","limit","skip"],"documents":"This function lists categories based on the provided API key, board ID, limit, and skip parameters.\\n\\nParameters:\\n- `invoker`: A function that performs the actual API call.\\n- `apiKey`: Your secret API key.\\n- `boardID`: The id of the board you\'d like to fetch categories for.\\n- `limit`: The number of categories you\'d like to fetch. Defaults to 10 if not specified. Max of 10000.\\n- `skip`: The number of categories you\'d like to skip before starting to fetch. Defaults to 0 if not specified.\\n\\nReturns:\\nAn object containing the categories and a hasMore property that specifies whether this query returns more categories than the limit.","fullCode":"(invoker, apiKey, boardID, limit = 10, skip = 0) => {\\n  const reqBody = {\\n    apiKey, boardID,\\n    limit: Math.min(Math.max(limit, 0), 10000),\\n    skip: Math.max(skip, 0)\\n  };\\n  const resp = await invoker({\\n    path: \'/categories/list\',\\n    method: \'POST\',\\n    body: reqBody\\n  });\\n  if (resp.status !== 200) {\\n    throw new Error(`API request failed with status ${resp.status}: ${resp.statusText}`);\\n  }\\n  return resp.result;\\n}"}',
    ),
    addLlmCache(
      4,
      'map2Function',
      'given below service functions:\nclass new-test-callgent {\n  "function name: POST:/boards/list": {"params":[invoker,apiKey], "documents":"This function lists all boards.\n\n@param {Function} invoker - A function that makes the actual API call.\n@param {string} apiKey - Your secret API key.\n\n@returns {Promise<Object>} A promise that resolves to an object containing the API result.\n@property {Array<Object>} boards - An array of board objects.\n@property {string} boards[].id - A unique identifier for the board.\n@property {string} boards[].created - Time at which the board was created, in ISO 8601 format.\n@property {boolean} boards[].isPrivate - Whether or not the board is set as private in the administrative settings.\n@property {string} boards[].name - The board\'s name.\n@property {number} boards[].postCount - The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete.\n@property {boolean} boards[].privateComments - Whether or not comments left on posts can be viewed by other end-users.\n@property {string} boards[].url - The URL to the board\'s page.\n@property {boolean} hasMore - Specifies whether this query returns more boards than the limit."},\n\n}\nand an service `invoker` function.\n\nPlease choose one function to fulfill below request:\n{\n"requesting function": "POST:/boards/list",\n"request from": "restAPI",\n"request_object": {"url":"/boards/list","method":"POST","headers":{"host":"127.0.0.1:3300","connection":"close","content-length":"0"},"query":{}},\n}\nand code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.\n\noutput a single-line json object:\n{ "funName": "the function name to be invoked", "params":"param names of the chosen function", "mapping": "the js function (invoker, request_object)=>{...;return functionArgsArray;}, full implementation to return the **real** args from request_object to invoke the chosen service function. don\'t use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}',
      '{"funName":"POST:/boards/list","params":["invoker","apiKey"],"mapping":"(invoker, request_object)=>{ let apiKey = request_object.params.uuids; return [invoker, apiKey]; }","question":"What is the API key for this request? It is not provided in the request_object."}',
    ),
  ];
}

async function addLlmCache(
  id: number,
  name: string,
  prompt: string,
  result: string,
) {
  const llmCacheDto = { id, name, prompt, result };
  return prisma.llmCache
    .upsert({
      where: { id },
      update: llmCacheDto,
      create: llmCacheDto,
    })
    .then((lmCache) => console.log({ lmCache }));
}
