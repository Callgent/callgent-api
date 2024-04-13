import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  initData();
  if (process.env.SEED_TEST_DATA) await initTestData();
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

async function initData() {
  const llmTplA2FDto: Prisma.LlmTemplateUncheckedCreateInput = {
    id: 1,
    name: 'api2Function',
    prompt: `Please convert below API of format {{=it.format}}:
{ "{{=it.apiName}}": {{=it.apiContent}} }

into a js method, the method must be as follows:
// the \`invoker\` function do the real invocation
async (invoker: {{=it.handle}}, ...necessary_biz_params) {...; const resp = await invoker(...); ...; return data; }

please generate the method with full implementation(pay attention to exceptions)! output a single-line json object:
{"signature":"js method name and signature, no type info on params/response, no implementation!", "documents":"method docs, with params and response properties explanations", "arrowFunc":"arrow function code without method name"}`,
  };
  const llmTplA2F = await prisma.llmTemplate.upsert({
    where: { id: 1 },
    update: llmTplA2FDto,
    create: llmTplA2FDto,
  });
  console.log({ llmTplA2F });
}

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

  addLlmCache(
    1,
    'api2Function',
    'Please convert below API of format restAPI:\n{ "POST:/boards/list": {"summary":"List all boards","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"apiKey":{"type":"string","description":"Your secret API key."}},"required":["apiKey"]}}},"required":true},"responses":{"200":{"description":"A dictionary with a \\"boards\\" property that contains an array of board objects.","content":{"application/json":{"schema":{"type":"object","properties":{"boards":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the board."},"created":{"type":"string","description":"Time at which the board was created, in ISO 8601 format."},"isPrivate":{"type":"boolean","description":"Whether or not the board is set as private in the administrative settings."},"name":{"type":"string","description":"The board\'s name."},"postCount":{"type":"integer","description":"The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete."},"privateComments":{"type":"boolean","description":"Whether or not comments left on posts can be viewed by other end-users."},"url":{"type":"string","description":"The URL to the board\'s page."}}}},"hasMore":{"type":"boolean","description":"Specifies whether this query returns more boards than the limit."}}}}}}}} }\n\ninto a js method, the method must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ data: any; dataType: string; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...necessary_biz_params) {...; const resp = await invoker(...); ...; return data; }\n\nplease generate the method with full implementation(pay attention to exceptions)! output a single-line json object:\n{"signature":"js method name and signature, no type info on params/response, no implementation!", "documents":"method docs, with params and response properties explanations", "arrowFunc":"arrow function code without method name"}',
    '{"signature":"listBoards(invoker, apiKey)","documents":"This method lists all boards.\\n\\nParameters:\\n- `invoker`: A function that performs the actual API call.\\n- `apiKey`: Your secret API key.\\n\\nReturns:\\nAn object containing the list of boards, each with the following properties:\\n- `id`: A unique identifier for the board.\\n- `created`: Time at which the board was created, in ISO 8601 format.\\n- `isPrivate`: Whether or not the board is set as private in the administrative settings.\\n- `name`: The board\'s name.\\n- `postCount`: The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete.\\n- `privateComments`: Whether or not comments left on posts can be viewed by other end-users.\\n- `url`: The URL to the board\'s page.","arrowFunc":"(invoker, apiKey) => {\\n  if (!apiKey) throw new Error(\\"apiKey is required\\");\\n  const req = {\\n    url: \\"/boards/list\\",\\n    method: \\"POST\\",\\n    headers: { \'Content-Type\': \'application/json\' },\\n    body: JSON.stringify({ apiKey }),\\n  };\\n  const resp = await invoker(req);\\n  if (resp.status !== 200) throw new Error(\\"Failed to list boards: \\" + resp.statusText);\\n  const { boards, hasMore } = resp.data;\\n  return { boards, hasMore };\\n}"}',
  );
  addLlmCache(
    2,
    'api2Function',
    'Please convert below API of format restAPI:\n{ "POST:/boards/retrieve": {"summary":"Retrieve board","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"apiKey":{"type":"string","description":"Your secret API key."},"id":{"type":"string","description":"The board\'s unique identifier."}},"required":["apiKey","id"]}}},"required":true},"responses":{"200":{"description":"Returns a board object, if a valid id was supplied.","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the board."},"created":{"type":"string","description":"Time at which the board was created, in ISO 8601 format."},"isPrivate":{"type":"boolean","description":"Whether or not the board is set as private in the administrative settings."},"name":{"type":"string","description":"The board\'s name."},"postCount":{"type":"integer","description":"The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete."},"privateComments":{"type":"boolean","description":"Whether or not comments left on posts can be viewed by other end-users."},"url":{"type":"string","description":"The URL to the board\'s page."}}}}}}}} }\n\ninto a js method, the method must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ data: any; dataType: string; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...necessary_biz_params) {...; const resp = await invoker(...); ...; return data; }\n\nplease generate the method with full implementation(pay attention to exceptions)! output a single-line json object:\n{"signature":"js method name and signature, no type info on params/response, no implementation!", "documents":"method docs, with params and response properties explanations", "arrowFunc":"arrow function code without method name"}',
    `{"signature":"retrieveBoard(invoker, apiKey, id)", "documents":"Retrieve a board object given an API key and board ID.\\n\\n@param {string} apiKey - Your secret API key.\\n@param {string} id - The board's unique identifier.\\n\\n@returns {Promise<object>} - A promise that resolves to an object containing the board's details if a valid id was supplied. The object has the following properties:\\n- id (string): A unique identifier for the board.\\n- created (string): Time at which the board was created, in ISO 8601 format.\\n- isPrivate (boolean): Whether or not the board is set as private in the administrative settings.\\n- name (string): The board's name.\\n- postCount (integer): The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete.\\n- privateComments (boolean): Whether or not comments left on posts can be viewed by other end-users.\\n- url (string): The URL to the board's page.", "arrowFunc":"(invoker, apiKey, id) => {\\n  const req = {\\n    path: '/boards/retrieve',\\n    method: 'POST',\\n    headers: { 'Content-Type': 'application/json' },\\n    body: JSON.stringify({\\n      apiKey, id\\n    }),\\n  };\\n  try {\\n    const resp = await invoker(req);\\n    if (resp.status !== 200) {\\n      throw new Error(\`Failed to retrieve board. Status: \${resp.status}\`);\\n    }\\n    return resp.data;\\n  } catch (error) {\\n    console.error(error);\\n    throw error;\\n  }\\n}"}`,
  );
  addLlmCache(
    3,
    'api2Function',
    'Please convert below API of format restAPI:\n{ "POST:/categories/list": {"summary":"List categories","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"apiKey":{"type":"string","description":"Your secret API key."},"boardID":{"type":"string","description":"The id of the board you\'d like to fetch categories for."},"limit":{"type":"integer","description":"The number of categories you\'d like to fetch. Defaults to 10 if not specified. Max of 10000."},"skip":{"type":"integer","description":"The number of categories you\'d like to skip before starting to fetch. Defaults to 0 if not specified."}},"required":["apiKey"]}}},"required":true},"responses":{"200":{"description":"A dictionary with a \\"categories\\" property that contains an array of tag objects. There\'s also a \\"hasMore\\" property that specifies whether this query returns more categories than the limit.","content":{"application/json":{"schema":{"type":"object","properties":{"categories":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the category."},"board":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the board."},"created":{"type":"string","description":"Time at which the board was created, in ISO 8601 format."},"isPrivate":{"type":"boolean","description":"Whether or not the board is set as private in the administrative settings."},"name":{"type":"string","description":"The board\'s name."},"postCount":{"type":"integer","description":"The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete."},"privateComments":{"type":"boolean","description":"Whether or not comments left on posts can be viewed by other end-users."},"url":{"type":"string","description":"The URL to the board\'s page."}},"description":"The board this category is associated with."},"created":{"type":"string","description":"Time at which the category was created, in ISO 8601 format."},"name":{"type":"string","description":"The name of the category."},"parentID":{"type":"string","description":"The id of the parent category. If this category is not a sub category, this field will be null."},"postCount":{"type":"integer","description":"The number of posts that have been assigned this category."},"url":{"type":"string","description":"The URL to the board, filtered to just posts that have been assigned this category."}}}},"hasMore":{"type":"boolean","description":"Specifies whether this query returns more categories than the limit."}}}}}}}} }\n\ninto a js method, the method must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ data: any; dataType: string; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...necessary_biz_params) {...; const resp = await invoker(...); ...; return data; }\n\nplease generate the method with full implementation(pay attention to exceptions)! output a single-line json object:\n{"signature":"js method name and signature, no type info on params/response, no implementation!", "documents":"method docs, with params and response properties explanations", "arrowFunc":"arrow function code without method name"}',
    '{"signature":"listCategories(invoker, apiKey, boardID, limit = 10, skip = 0)","documents":"This method lists categories for a given board.\\n\\nParameters:\\n- `invoker`: A function that performs the actual API call.\\n- `apiKey`: Your secret API key.\\n- `boardID`: The id of the board you\'d like to fetch categories for.\\n- `limit` (optional): The number of categories you\'d like to fetch. Defaults to 10 if not specified. Max of 10000.\\n- `skip` (optional): The number of categories you\'d like to skip before starting to fetch. Defaults to 0 if not specified.\\n\\nReturns:\\nAn object containing a \'categories\' property that is an array of category objects. Also includes a \'hasMore\' property that specifies whether this query returns more categories than the limit.","arrowFunc":"(invoker, apiKey, boardID, limit = 10, skip = 0) => {\\n  const body = {\\n    apiKey,\\n    boardID\\n  };\\n  if (limit) body.limit = limit;\\n  if (skip) body.skip = skip;\\n\\n  const resp = await invoker({\\n    path: \'/categories/list\',\\n    method: \'POST\',\\n    body\\n  });\\n\\n  if (resp.status !== 200) {\\n    throw new Error(`API request failed with status ${resp.status}: ${resp.statusText}`);\\n  }\\n\\n  return resp.data;\\n}"}',
  );
  addLlmCache(
    4,
    'api2Function',
    'Please convert below API of format restAPI:{ "POST:/categories/retrieve": {"summary":"Retrieve category","requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"apiKey":{"type":"string","description":"Your secret API key."},"id":{"type":"string","description":"The category\'s unique identifier."}},"required":["apiKey","id"]}}},"required":true},"responses":{"200":{"description":"Returns a category object, if a valid id was supplied.","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the category."},"board":{"type":"object","properties":{"id":{"type":"string","description":"A unique identifier for the board."},"created":{"type":"string","description":"Time at which the board was created, in ISO 8601 format."},"isPrivate":{"type":"boolean","description":"Whether or not the board is set as private in the administrative settings."},"name":{"type":"string","description":"The board\'s name."},"postCount":{"type":"integer","description":"The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete."},"privateComments":{"type":"boolean","description":"Whether or not comments left on posts can be viewed by other end-users."},"url":{"type":"string","description":"The URL to the board\'s page."}},"description":"The board this category is associated with."},"created":{"type":"string","description":"Time at which the category was created, in ISO 8601 format."},"name":{"type":"string","description":"The name of the category."},"parentID":{"type":"string","description":"The id of the parent category. If this category is not a sub category, this field will be null."},"postCount":{"type":"integer","description":"The number of posts that have been assigned this category."},"url":{"type":"string","description":"The URL to the board, filtered to just posts that have been assigned this category."}}}}}}}} }into a js method, the method must be as follows:// the `invoker` function do the real invocationasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ data: any; dataType: string; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...necessary_biz_params) {...; const resp = await invoker(...); ...; return data; }please generate the method with full implementation(pay attention to exceptions)! output a single-line json object:{"signature":"js method name and signature, no type info on params/response, no implementation!", "documents":"method docs, with params and response properties explanations", "arrowFunc":"arrow function code without method name"}',
    '{"signature":"retrieveCategory(invoker, apiKey, id)","documents":"\\nThis function retrieves a category object given a valid API key and category ID.\\n\\n@param {Object} invoker - A function that makes the actual API call.\\n@param {string} apiKey - Your secret API key.\\n@param {string} id - The category\'s unique identifier.\\n\\n@returns {Promise<Object>} A Promise that resolves to an object containing the retrieved category data.\\n","arrowFunc":"async (invoker, apiKey, id) => {\\n const url = \'/categories/retrieve\';\\n const reqBody = {\\n apiKey, id\\n };\\n\\n try {\\n const response = await invoker({\\n path: url,\\n method: \'POST\',\\n headers: {\'Content-Type\': \'application/json\'}, // assuming JSON is required\\n body: JSON.stringify(reqBody)\\n });\\n\\n if (!response.ok) {\\n throw new Error(`API request failed with status ${response.status}`);\\n }\\n\\n const data = await response.json();\\n return data;\\n } catch (error) {\\n console.error(\'An error occurred while fetching the category:\', error);\\n throw error;\\n }\\n}"}',
  );
}

async function addLlmCache(
  id: number,
  name: string,
  prompt: string,
  result: string,
) {
  const llmCacheDto = { id, name, prompt, result };
  const llmCacheA2F = await prisma.llmCache.upsert({
    where: { id },
    update: llmCacheDto,
    create: llmCacheDto,
  });
  console.log({ llmCacheA2F });
}
