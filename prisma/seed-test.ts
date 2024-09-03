import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  return await Promise.all(initTestData());
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

function initTestData() {
  const tenant: Prisma.TenantUncheckedCreateInput = {
    pk: 1,
    id: 'TEST_TENANT_ID',
    statusCode: 1,
  };

  const userId = 'TEST_USER_ID';
  const u: Prisma.UserUncheckedCreateInput = {
    pk: 1,
    id: userId,
    name: 'test-user',
    tenantPk: 1,
  };

  const ui: Prisma.UserIdentityUncheckedCreateInput = {
    pk: 1,
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
    pk: 1,
    token: 'TEST-ONLY-API_KEY',
    type: 'API_KEY',
    payload: {
      sub: userId,
      aud: 'appKey',
    },
  };

  const callgentDto: Prisma.CallgentUncheckedCreateInput = {
    pk: 1,
    id: 'TEST_CALLGENT_ID',
    name: 'test-callgent',
    tenantPk: 1,
    createdBy: userId,
  };

  const cepDto: Prisma.EndpointUncheckedCreateInput = {
    pk: 1,
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
        where: { pk: 1 },
        update: tenant,
        create: tenant,
      })
      .then((tenant) => {
        console.log({ tenant });
        prisma.user
          .upsert({
            where: { pk: 1 },
            update: u,
            create: u,
          })
          .then((user) => {
            (ui as any).pk = 1;
            (ui as any).userId = user.id;
            prisma.userIdentity
              .upsert({
                where: { pk: 1 },
                update: ui,
                create: ui,
              })
              .then((userIdentity) => console.log({ user, userIdentity }));
          });
      }),
    prisma.authToken
      .upsert({
        where: { pk: 1 },
        update: authTokenDto,
        create: authTokenDto,
      })
      .then((authToken) => console.log({ authToken })),
    prisma.callgent
      .upsert({
        where: { pk: 1 },
        update: callgentDto,
        create: callgentDto,
      })
      .then((callgent) => console.log({ callgent })),
    prisma.endpoint
      .upsert({
        where: { pk: 1 },
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
      '{"funName":"retrieveBoard","params":["invoker","apiKey","id"],"documents":"This function retrieves a board object given a valid API key and board ID.\\n\\nParameters:\\n- invoker: A function that performs the actual API call.\\n- apiKey: Your secret API key.\\n- pk: The board\'s unique identifier.\\n\\nReturns:\\nAn object containing the board details if a valid id was supplied. The object properties are:\\n- pk: A unique identifier for the board.\\n- created: Time at which the board was created, in ISO 8601 format.\\n- isPrivate: Whether or not the board is set as private in the administrative settings.\\n- name: The board\'s name.\\n- postCount: The number of non-deleted posts associated with the board. This number includes posts that are marked as closed or complete.\\n- privateComments: Whether or not comments left on posts can be viewed by other end-users.\\n- url: The URL to the board\'s page.","fullCode":"(invoker, apiKey, id) => {\\n  const req = {\\n    path: \'/boards/retrieve\',\\n    method: \'POST\',\\n    headers: { \'Content-Type\': \'application/json\' },\\n    body: JSON.stringify({\\n      apiKey, id\\n    })\\n  };\\n  try {\\n    const resp = await invoker(req);\\n    if (resp.status !== 200) {\\n      throw new Error(`Failed to retrieve board. Status: ${resp.status}`);\\n    }\\n    return resp.result;\\n  } catch (error) {\\n    console.error(error);\\n    throw error;\\n  }\\n}"}',
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
      '{"funName":"POST:/boards/list","params":["invoker","apiKey"],"mapping":"(invoker, request_object)=>{ let apiKey = request_object.params.ids; return [invoker, apiKey]; }","question":"What is the API key for this request? It is not provided in the request_object."}',
    ),
    addLlmCache(
      5,
      'api2Function',
      'Please convert below API doc of format restAPI:\n{ "GET:/positions": {"summary":"List all job positions","description":"Retrieve a list of all available job positions.","operationId":"listPositions","responses":{"200":{"description":"A list of job positions","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Unique identifier for the job position"},"title":{"type":"string","description":"Title of the job position"},"description":{"type":"string","description":"Description of the job position"},"location":{"type":"string","description":"Location of the job position"},"requirements":{"type":"array","items":{"type":"string"},"description":"List of requirements for the job position"},"createdAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was created"},"updatedAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was last updated"}}}}}}},"500":{"description":"Internal Server Error"}}} }\n\ninto a js function, the function must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }\n\nplease generate the js function with **full implementation and error handling**! output a single-line json object:\n{"funName":"function name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}',
      '{"funName":"listPositions","params":["invoker"],"documents":"/**\n * List all job positions\n * Retrieve a list of all available job positions.\n * @param {Function} invoker - The function that performs the real invocation.\n * @returns {Promise<Object>} - A promise that resolves to an object containing the API result.\n * @property {Array<Object>} apiResult - A list of job positions.\n * @property {string} apiResult[].id - Unique identifier for the job position.\n * @property {string} apiResult[].title - Title of the job position.\n * @property {string} apiResult[].description - Description of the job position.\n * @property {string} apiResult[].location - Location of the job position.\n * @property {Array<string>} apiResult[].requirements - List of requirements for the job position.\n * @property {string} apiResult[].createdAt - Timestamp when the job position was created.\n * @property {string} apiResult[].updatedAt - Timestamp when the job position was last updated.\n */","fullCode":"async (invoker) => {\n  try {\n    const json = await invoker({\n      path: \'/positions\',\n      method: \'GET\'\n    });\n    if (json.status === 200) {\n      return json.apiResult;\n    } else if (json.status === 500) {\n      throw new Error(\'Internal Server Error\');\n    } else {\n      throw new Error(\'Unexpected status code: \' + json.status);\n    }\n  } catch (error) {\n    console.error(\'Error fetching job positions:\', error);\n    throw error;\n  }\n}"}',
    ),
    addLlmCache(
      6,
      'api2Function',
      'Please convert below API doc of format restAPI:\n{ "GET:/positions/{positionId}": {"summary":"View a specific job position","description":"Retrieve details of a specific job position by its ID.","operationId":"viewPosition","parameters":[{"name":"positionId","in":"path","required":true,"schema":{"type":"string"},"description":"The ID of the job position to retrieve"}],"responses":{"200":{"description":"Details of the job position","content":{"application/json":{"schema":{"type":"object","properties":{"id":{"type":"string","description":"Unique identifier for the job position"},"title":{"type":"string","description":"Title of the job position"},"description":{"type":"string","description":"Description of the job position"},"location":{"type":"string","description":"Location of the job position"},"requirements":{"type":"array","items":{"type":"string"},"description":"List of requirements for the job position"},"createdAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was created"},"updatedAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was last updated"}}}}}},"404":{"description":"Job position not found"},"500":{"description":"Internal Server Error"}}} }\n\ninto a js function, the function must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }\n\nplease generate the js function with **full implementation and error handling**! output a single-line json object:\n{"funName":"function name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}',
      '{"funName":"viewPosition","params":["invoker","positionId"],"documents":"/**\\n * View a specific job position\\n * Retrieve details of a specific job position by its ID.\\n * @param {Function} invoker - The function that performs the real invocation.\\n * @param {string} positionId - The ID of the job position to retrieve.\\n * @returns {Promise<Object>} - A promise that resolves to the job position details.\\n * @property {string} id - Unique identifier for the job position.\\n * @property {string} title - Title of the job position.\\n * @property {string} description - Description of the job position.\\n * @property {string} location - Location of the job position.\\n * @property {Array<string>} requirements - List of requirements for the job position.\\n * @property {string} createdAt - Timestamp when the job position was created.\\n * @property {string} updatedAt - Timestamp when the job position was last updated.\\n */","fullCode":"async (invoker, positionId) => {\\n    try {\\n        const json = await invoker({\\n            path: `/positions/${positionId}`,\\n            method: \'GET\',\\n            params: { positionId }\\n        });\\n        if (json.status === 200) {\\n            return json.apiResult;\\n        } else if (json.status === 404) {\\n            throw new Error(\'Job position not found\');\\n        } else if (json.status === 500) {\\n            throw new Error(\'Internal Server Error\');\\n        }\\n    } catch (error) {\\n        throw new Error(`Error fetching job position: ${error.message}`);\\n    }\\n}"}',
    ),
    addLlmCache(
      7,
      'api2Function',
      'Please convert below API doc of format restAPI:\n{ "POST:/positions/{positionId}/apply": {"summary":"Apply for a position","description":"Submit an application for a specific job position.","operationId":"applyForPosition","parameters":[{"name":"positionId","in":"path","required":true,"schema":{"type":"string"},"description":"The ID of the job position to apply for"}],"requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"applicantName":{"type":"string","description":"Name of the applicant"},"email":{"type":"string","format":"email","description":"Email address of the applicant"},"resume":{"type":"string","format":"binary","description":"Resume of the applicant"},"coverLetter":{"type":"string","description":"Cover letter of the applicant"},"appliedAt":{"type":"string","format":"date-time","description":"Timestamp when the application was submitted"}}}}}},"responses":{"201":{"description":"Application submitted successfully"},"400":{"description":"Invalid input"},"404":{"description":"Job position not found"},"500":{"description":"Internal Server Error"}}} }\n\ninto a js function, the function must be as follows:\n// the `invoker` function do the real invocation\nasync (invoker: (req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }\n\nplease generate the js function with **full implementation and error handling**! output a single-line json object:\n{"funName":"function name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}',
      '{"funName":"applyForPosition","params":["invoker","positionId","applicantName","email","resume","coverLetter","appliedAt"],"documents":"/**\\n * Apply for a position\\n * @param {Function} invoker - The function that performs the actual API invocation.\\n * @param {string} positionId - The ID of the job position to apply for.\\n * @param {string} applicantName - Name of the applicant.\\n * @param {string} email - Email address of the applicant.\\n * @param {string} resume - Resume of the applicant.\\n * @param {string} coverLetter - Cover letter of the applicant.\\n * @param {string} appliedAt - Timestamp when the application was submitted.\\n * @returns {Promise<{apiResult: any, headers?: { [key: string]: string }, status?: number, statusText?: string}>} The result of the API call.\\n */","fullCode":"async (invoker, positionId, applicantName, email, resume, coverLetter, appliedAt) => {\\n  try {\\n    const req = {\\n      path: `/positions/${positionId}/apply`,\\n      method: \'POST\',\\n      headers: {\\n        \'Content-Type\': \'application/json\'\\n      },\\n      body: {\\n        applicantName,\\n        email,\\n        resume,\\n        coverLetter,\\n        appliedAt\\n      }\\n    };\\n    const json = await invoker(req);\\n    if (json.status === 201) {\\n      return { apiResult: json.apiResult, headers: json.headers, status: json.status, statusText: json.statusText };\\n    } else if (json.status === 400) {\\n      throw new Error(\'Invalid input\');\\n    } else if (json.status === 404) {\\n      throw new Error(\'Job position not found\');\\n    } else if (json.status === 500) {\\n      throw new Error(\'Internal Server Error\');\\n    } else {\\n      throw new Error(\'Unknown error\');\\n    }\\n  } catch (error) {\\n    console.error(\'Error applying for position:\', error.message);\\n    throw error;\\n  }\\n}"}',
    ),
    addLlmCache(
      8,
      'map2Function',
      'given below service APIs:\nservice test-callgent {\n  "API: GET /positions": {"endpoint": "GET /positions", "summary":"listPositions: List all job positions", "description":"Retrieve a list of all available job positions.", "signature":{"responses":{"200":{"description":"A list of job positions","content":{"application/json":{"schema":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","description":"Unique identifier for the job position"},"title":{"type":"string","description":"Title of the job position"},"description":{"type":"string","description":"Description of the job position"},"location":{"type":"string","description":"Location of the job position"},"requirements":{"type":"array","items":{"type":"string"},"description":"List of requirements for the job position"},"createdAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was created"},"updatedAt":{"type":"string","format":"date-time","description":"Timestamp when the job position was last updated"}}}}}}},"500":{"description":"Internal Server Error"}}} },\n}\n\nPlease choose one API to fulfill below request:\n{\n"requesting endpoint": "GET /positions",\n"request from": "restAPI",\n"request_object": {"url":"/positions","method":"GET","headers":{"user-agent":"Apifox/1.0.0 (https://apifox.com)","accept":"*/*","host":"127.0.0.1:3000","accept-encoding":"gzip, deflate, br","connection":"keep-alive"},"query":{}},\n}\nand code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.\n\noutput a single-line json object:\n{ "endpoint": "the chosen API endpoint to be invoked", "args":"request params/body/headers/..., with same structure as the signature JSON object(no more args than it), or null if no args needed", "mapping": "if the the request_object is structured (or null if unstructured), generate the js function (request_object)=>{...;return API_signature_args;}, full implementation to return the **real** args from request_object to invoke the API. don\'t use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}',
      '{ "endpoint": "GET /positions", "args": null, "mapping": "(request_object)=>{return null;}", "question": null }',
    ),
  ];
}

async function addLlmCache(
  pk: number,
  name: string,
  prompt: string,
  result: string,
) {
  const llmCacheDto = { pk, name, prompt, result };
  return prisma.llmCache
    .upsert({
      where: { pk },
      update: llmCacheDto,
      create: llmCacheDto,
    })
    .then((lmCache) => console.log({ lmCache }));
}
