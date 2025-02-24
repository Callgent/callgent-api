import { Prisma, PrismaClient } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

async function main() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  return await prisma
    .$transaction(async (prisma) => {
      await prisma.$executeRaw`SELECT set_config('tenancy.bypass_rls', 'on', ${true})`;
      await Promise.all(initData(prisma));
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

function initData(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) {
  return [
    ...initEventListeners(prisma),
    initLlmTemplates(prisma),
    ...initTags(prisma),
    ...initModelPricing(prisma),
  ];
}

function initEventListeners(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) {
  let priority = -100;
  const els: Prisma.EventListenerUncheckedCreateInput[] = [
    {
      id: 'CR-ADAPTOR-PREPROCESS',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EntriesService',
      funName: 'preprocessClientRequest',
      description:
        'Find the CEP, then preprocess the request, replace raw request.',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-CEN-AUTH',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'CallgentRealmsService',
      funName: 'checkCenAuth',
      description: 'Auth-check before centry invocation.',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-LOAD-TARGET',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EventStoresService',
      funName: 'loadClientEventHistories',
      description: 'Load all events of same taskId into event.histories',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-LOAD-ENDPOINTS',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EndpointsService',
      funName: 'loadEndpoints',
      description: 'Load all endpoints into event.context.endpoints',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-GENERATE-WEBPAGE',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: 'Webpage',
      serviceType: 'SERVICE',
      serviceName: 'WebpageService',
      funName: 'genWebpages',
      description:
        'Generate webpage[view/model/view-model] from request & endpoints',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-MAP-2-ENDPOINTS',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'ScriptAgentService',
      funName: 'map2Endpoints',
      description:
        'Map the request to endpoints and corresponding args, put into event.context.map2Endpoints and event.context.endpoints[0]',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-SCRIPT-RUNNER',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'ScriptRunnerAgent',
      funName: 'runAndFix',
      description:
        'Run and fix script until success, return the final response',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
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

async function initLlmTemplates(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) {
  const llmTemplates: Prisma.LlmTemplateUncheckedCreateInput[] = [
    //     {
    //       name: 'api2Function',
    //       prompt: `Please convert below API doc of format {{=it.format}}:
    // { "{{=it.apiName}}": {{=it.apiContent}} }

    // into a js function, the function must be as follows:
    // // the \`invoker\` function do the real invocation
    // async (invoker: {{=it.handle}}, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }

    // please generate the js function with **full implementation and error handling**! output a single-line json object:
    // {"epName":"endpoint name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}`,
    //     },
    {
      name: 'map2Endpoint',
      prompt: `given below service endpoint:
service \`{{=it.callgentName}}\` { {{~ it.endpoints :ep }}
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },
{{~}}}

Please generate js function req2Args(request) to map below request into endpoint args following the openAPI params schema:
const request_object = {{=JSON.stringify(it.req)}};

output single-line json object below:
{ "req2Args": "Full code of js function req2Args(request_object):ArgsMap, to map request into endpoint args. ArgsMap is a k-v map of vars in endpoint.params(no conflict keys, no more props than it), all values just extracted from request_object, but no direct constant in code from request_object, all calculated from request_object props as variables!" },
output just json no explanation`,
    },
    {
      name: 'chooseEndpoints',
      prompt: `## Input:
1. **User Requirements**: All Information are provided in conversations for user task goal{{ if (it.files.length) { }}
   - **User uploaded files**: files mentioned in conversation are placed in current dir \`./upload\` of local disk{{ } }}
2. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
   \`\`\`json
   {
     "serviceName": "{{=it.callgent.name}}",
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`

## Objectives:
You are an expert in analyzing OpenAPI documents and understanding user requirements. Your task is to help the user identify which APIs from the provided OpenAPI document are necessary to orchestrate a script to fulfill user task goal.
1. Understand the Requirements: Carefully read the conversations and comprehend the user's requirements
2. Analyze the OpenAPI Document: Review the provided OpenAPI document to understand the available endpoints, their functionalities, request parameters, and response structures
3. Match Requirements to APIs: Identify which APIs from the OpenAPI document are relevant to the user's requirements, don't imagine non-existing endpoint!
4. Explain the Purpose: For each identified API, explain its purpose and how it meets the user's needs
5. It's very likely there is not enough APIs to fulfill user requirements, place the purposes into \`unaddressedAPI\` list

## Deliverables:
output complete purposes in json format:
\`\`\`json
{
  "unaddressedAPI":[{
    "usedFor":"Explain the unaddressedAPI Purpose, which need an external API endpoint, but no appropriate one found"
    "purposeKey":"unique purpose key",
    "needExternalAPI": "boolean. true: if external service openAPI is needed; Note: if can be handled by local script code, please set to false"
  },..],
  "usedEndpoints":[{
    "usedFor":"Explain the Purpose of the endpoint, double check it matches with user goal",
    "purposeKey":"unique purpose key",
    "epName":"the original name of chosen endpoint to be invoked. don't fake it!",
    "description":"endpoint functionality descriptions sourced only from the openAPI doc"
  },..]
}
\`\`\`

### Notes:
- Be precise and detailed in your analysis, to ensure the output list can fulfill all user's requirements
- it's ok if some chosen endpoints are not finally used
- **Don't** choose wrong endpoints which may cause unexpected loss, better miss than wrong!
- \`epName\` must exist in \`The given service endpoint APIs\`, better empty than fake!`,
    },
    {
      name: 'reChooseEndpoints',
      prompt: `## Input:
1. **User Requirements**: All Information are provided in conversations for user task goal{{ if (it.files.length) { }}
   - **User uploaded files**: files mentioned in conversation are placed in current dir \`./upload\` of local disk{{ } }}
2. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
   \`\`\`json
   {
     "serviceName": "{{=it.callgent.name}}",
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`
3. **The split \`usedFor\` purposes to fulfill user goal**:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`
   
## Objectives:
You are an expert in analyzing OpenAPI documents and understanding user requirements. Your task is to help the user identify which APIs from the provided OpenAPI document are necessary to orchestrate a script to fulfill user task goal.
1. Understand the Requirements: Carefully read the conversations and comprehend the user's requirements
2. Analyze the OpenAPI Document: Review the provided OpenAPI document to understand the available endpoints, their functionalities, request parameters, and response structures
3. Examine the split \`usedFor\` purposes: Are the purposes complete enough to meet all user requirements
4. Address which endpoint is best suited for each \`usedFor\` purpose, don't imagine **non-existing** endpoint!
5. It's very likely there is no appropriate endpoint for \`usedFor\` purpose, move it from \`usedEndpoints\` into \`unaddressedAPI\` list

## Deliverables:
output complete purposes in json format:
\`\`\`json
{
  "unaddressedAPI":[{
    "usedFor":"Explain the unaddressedAPI Purpose, which need an external API endpoint, but no appropriate one found"
    "purposeKey":"unique purpose key",
    "needExternalAPI": "boolean. true: if external service API is needed; false: if can be handled by local script code"
  },..],
  "usedEndpoints":[{
    "usedFor":"Explain the Purpose of the endpoint, double check it matches with user goal",
    "purposeKey":"unique purpose key",
    "epName":"the original name of chosen endpoint to be invoked. don't fake it!",
    "description":"endpoint functionality descriptions sourced only from the openAPI doc"
  },..]
}
\`\`\`

### Notes:
- Be precise and detailed in your analysis, to ensure the output list can fulfill all user's requirements
- it's ok if some chosen endpoints are not finally used
- **Don't** choose wrong endpoints which may cause unexpected loss, better miss than wrong!
- Double check \`epName\` exists in \`The given service endpoint APIs\`, better empty than fake!`,
    },
    {
      name: 'confirmEndpoints',
      prompt: `## Input:
1. **User Requirements**: All Information are provided in conversations for user task goal{{ if (it.files.length) { }}
   - **User uploaded files**: files mentioned in conversation are placed in current dir \`./upload\` of local disk{{ } }}
2. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
   \`\`\`json
   {
     "serviceName": "{{=it.callgent.name}}",
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`
3. **Per API Perspective Split Purposes**:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`

## Objectives:
Analyze the provided user requirements in conversation, and the split purposes per API perspective to achieve the user requirements goals,

Opt the best endpoint for each item in \`optEndpoints\` to fulfill \`usedFor\` purpose.

## Deliverables:
Output all purposes from \`optEndpoints\` and \`confirmedEndpoints\` in json array:
\`\`\`json
[{
  "purposeKey": "unique purpose key",
  "usedFor": "Explain the Purpose of the endpoint, double check it matches with user goal",
  "epName": "the original name of chosen endpoint to be invoked. don't fake it!",
  "description": "endpoint functionality descriptions sourced only from the openAPI doc"
},..]
\`\`\`

Note: Ensure accuracy and avoid assumptions beyond the provided info`,
    },
    {
      name: 'confirmEndpointsArgs',
      prompt: `## Input:
1. **User Requirements**: All Information are provided in conversations for user task goal{{ if (it.files.length) { }}
   - **User uploaded files**: files mentioned in conversation are placed in current dir \`./upload\` of local disk{{ } }}
2. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
   \`\`\`json
   {
     "serviceName": "{{=it.callgent.name}}",
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`
3. **Chosen OpenAPI Endpoints**: A list of endpoints needed to fulfill the user requirements:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`

## Objectives:
Analyze user requirements from conversations and uploaded files alongside the chosen OpenAPI endpoints. Evaluate the inputs for sufficiency and identify any missing parameters necessary to fulfill the task.

Your goal is to:
1. Extract all required arguments from user information to prepare for invoking the endpoints:
2. Identify gaps where:
   - **Missing information**: User-provided information is insufficient to invoke chosen endpoints
   - **Ambiguous**: user provided info is unclear or contradictory
   - **Missing conversion**: args info is sufficient, but additional mapping-dictionaries or APIs are required(but absent) to convert the user data into endpoint parameter type/value, e.g.: mapping to enumerations, converting name to entity ID, converting keys to values, etc

## Deliverables:
Output the argument sourcing in JSON format:
\`\`\`json
[{
  "purposeKey": "",
  "args": [{
    "argName": "Endpoint full path arg name, e.g.: \`requestBody.prop1.list2.prop3\` or \`parameters.prop4\`. If the parameter/requestBody is an object, drill down its properties and repeat the analysis for each property",
    "retrieved-from-API-calls": ["If some values source from preceding endpoints call responses, list of \`purposeKey\`s invoked to retrieve the values", "leave empty if needn't"],
    "extracted-from-user-info-or-files": {
      "flag": "boolean: true if some values source from user-provided info/files",
      "userProvided": "if flag true, give description of which user info or files to source this value; Encourage **best guess** of arg source from user info",
      "needConfirm": "if flag true, send user this question alone to clarify. Please least bother user for best user experience. Leave empty if needn't confirm"
    },
    "mapping": {
      "from":"extracted info type and edge conditions","to":"endpoint parameter type and constraints","mismatch":"boolean: whether \`from\` mismatches \`to\`",
      "conversion": {
        "steps":["if mismatch, steps to convert extracted info into valid endpoint arg"],
        "missing":"boolean: true if use info is sufficient but, mismatch=true and mapping-dictionaries or API is **not explicitly specified** anywhere, which makes it impossible to convert"
      }
    },
  },..]
},..]
\`\`\`  

### Notes:
- Ensure endpoint purposes match user goals precisely
- Ensure all arg values are sourced from real data as user provided. Do not use imaginary/fake/example/mock/test data as arg values
  - Please Don't make assumption on any missing info, ask the user directly
  - There must be at least one source for each argument
- One arg may have multiple sources. remove json node flagged as false
- at least one source must be identified: retrieved-from-API-calls.length>0 or extracted-from-user-info-or-files.flag is true
  - don't list optional args, only list args that are necessary to fulfill the task`,
    },
    {
      name: 'reConfirmEndpointsArgs',
      prompt: `## Input:
1. **User Requirements**: All Information are provided in conversations for user task goal{{ if (it.files.length) { }}
   - **User uploaded files**: files mentioned in conversation are placed in current dir \`./upload\` of local disk{{ } }}
2. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
   \`\`\`json
   {
     "serviceName": "{{=it.callgent.name}}",
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`
3. **Chosen OpenAPI Endpoints**: A list of endpoints needed to fulfill the user requirements:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`
4. **Uncertain Endpoint arguments to Analyze**:
   \`\`\`json
   {{=JSON.stringify(it.reConfirmArgs)}}
   \`\`\`

## Objectives:
Analyze user requirements from conversations and uploaded files alongside the chosen OpenAPI endpoints. Evaluate the inputs for sufficiency and identify any missing parameters necessary to fulfill the task.

Your goal is to:
1. Analyze the **Uncertain** args to prepare for invoking the endpoints:
2. Identify gaps where:
   - **Missing information**: User-provided information is insufficient to invoke chosen endpoints
   - **Ambiguous**: user provided info is unclear or contradictory
   - **Missing conversion**: args info is sufficient, but additional mapping-dictionaries or APIs are required(but absent) to convert the user data into endpoint parameter type/value, e.g.: mapping to enumerations, converting name to entity ID, converting keys to values, etc

## Deliverables:
Output the Uncertain arguments sourcing in JSON format:
\`\`\`json
[{
  "purposeKey": "",
  "args": [{
    "argName": "Endpoint full path arg name, e.g.: \`requestBody.prop1.list2.prop3\` or \`parameters.prop4\`. If the parameter/requestBody is an object, drill down its properties and repeat the analysis for each property",
    "retrieved-from-API-calls": ["If some values source from preceding endpoints call responses, list of \`purposeKey\`s invoked to retrieve the values", "leave empty if needn't"],
    "extracted-from-user-info-or-files": {
      "flag": "boolean: true if some values source from user-provided info/files",
      "userProvided": "if flag true, give description of which user info or files to source this value; Encourage **best guess** of arg source from user info",
      "needConfirm": "if flag true, send user this question alone to clarify. Please least bother user for best user experience. Leave empty if needn't confirm"
    },
    "mapping": {
      "from":"extracted info type and edge conditions","to":"endpoint parameter type and constraints","mismatch":"boolean: whether \`from\` mismatches \`to\`",
      "optional":"boolean: where parameter optional or has default value",
      "conversion": {
        "steps":["if mismatch, steps to convert extracted info into valid endpoint arg"],
        "missing":"boolean: true if use info is sufficient but, mismatch=true and mapping-dictionaries or API is **not explicitly specified** anywhere, which makes it impossible to convert"
      }
    },
  },..]
},..]
\`\`\`  

### Notes:
- Only analyze the **Uncertain** args, which are not clear or contradictory, or missing conversion
- Ensure all arg values are sourced from real data as user provided. Do not use imaginary/fake/example/mock/test data as arg values
  - There must be at least one source for each argument
- One arg may have multiple sources. remove json node flagged as false`,
    },
    {
      name: 'generateTaskScript',
      prompt: `## Input:
1. **User Requirements**: All Information are provided in conversations for user task goal{{ if (it.files.length) { }}
   - **User uploaded files**: files mentioned in conversation are placed in current dir \`./upload\` of local disk{{ } }}
2. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
   \`\`\`json
   {
     "serviceName": "{{=it.callgent.name}}",
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`
3. **Chosen OpenAPI Endpoints**: A list of endpoints needed to fulfill the user requirements:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`
4. **Endpoint Argument Hints**:
   \`\`\`json
   {{=JSON.stringify(it.argsHints)}}
   \`\`\`

## Objectives:
You are a software developer focusing on code implementation with high performance and fault tolerance. Given user requirements from conversations and uploaded files alongside the chosen OpenAPI endpoints.

Generate a TypeScript class on node18+ that adheres to the following criteria:
1. **Clear Class Design**: Choose a self-explanatory class name that reflects its purpose based on the user requirements. then default export this class
2. **Predefined Members**:
   - the default no-argument constructor should be defined
   - Primary Entry Point: the \`async execute(): Promise<any>\` method as the main entry point for executing the required task
     - return the final result of the task execution, which will be put into conversation history, for further user actions
     - if task result is too large, only output the summary, and save the full result into a file under \`./result\` dir
   - Persistent Class Field: define public \`resumingStates\` object structure to persist via \`JSON.stringify\` in db, enabling the task instance being reloaded to resume from the last iteration stopping point seamlessly by calling reentrant \`execute()\`
     - this is the only field restored to resume the task, task runner will save/load it for you automatically
     - e.g., a \`processedItems\` or \`currentIdx\` may be defined in this object to skip processed items on retry
   - Endpoint Invoke Helper: an predefined public member function \`invokeService(purposeKey: string, args:{parameters?:{[paramName:string]:any},requestBody?:any}): Promise<any>\`
     - don't define this method in the class body, the task runner will inject the implementation for you
     - this method just relays req/resp, please handle validations/exceptions/retry by yourself
3. **Modular and Reusable Code**: Implement well-structured member functions to encapsulate specific logic, ensuring the class is modular, reusable, and easy to maintain
4. **Best Performance**: Estimate heavy resources/io/mem/cpu loads, and optimization strategies, especially preload/cache frequently accessed resources/handles out of loops as local vars or files:
   - disk space is big enough, temp files may be created under \`./tmp\`, you needn't clean them, task runner does this after all iterations
     - check temp files existence on reentrant calls
   - parallel processing iteration items in batch is critical for speed, estimate a batch size
   - prevent performance/lock issues on  accessing the same resource the same time in batch
5. **Robust and Fault-Tolerant**:
   - Thoroughly analyze the input, output, exceptions, and side effects of all dependent API endpoints and resources
   - Handle edge cases and values and errors gracefully to ensure reliability, including args validation, response type checking, error handling
     - strictly use \`Optional Chaining Operators\` to prevent foolish npe errors
   - Transaction isolation for disk operations, especially in below cases:
     - concurrent write access
     - failover and cleanup on errors, since the task runner will retry the task after script fix
     - caching on reentrant calls, if recall after errors, make sure the cache is valid
6. Log essential info, keep logs concisely and readable, no massive logs output:
   - \`console.info\` for progress \`indices/totals\`
   - \`console.warn\` on failed items, and only errors critical failures
   - \`console.error\` text will be used to fix the script code and retry execution, so make it clear and concise, no unnecessary info!

## Deliverables:
1. Describe optimization strategies based on estimated heavy resources loads. All in pullet items.
2. Estimated total execution time range in code block:
\`\`\`text
short desc in one line
\`\`\`
3. Describe the resumingStates object structure for reentrant task resuming in bullet items, only define essential props
4. Generate the class code(no usage code) in main.ts, which can be directly executed without any modification(so output full code):
\`\`\`typescript
// os independent full code
\`\`\`
5. package.json
  - don't import Node.js built-in modules
  - prevent using outdated/deprecated packages or versions, better use the latest stable versions updated within the last 3 years
  - script is run with \`tsx\`
\`\`\`json
\`\`\``,
    },
    {
      name: 'convert2Response',
      prompt: `Given the openAPI endpoint:
\`\`\`json
{"endpoint": "{{=it.ep.name}}""{{=it.ep.summary?', "summary":'+it.ep.summary:''}}", {{=it.ep.description ? '"description":"'+it.ep.description+'", ':''}}"parameters":{{=JSON.stringify(it.ep.params.parameters)}}, {{ if (it.ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(it.ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(it.ep.responses)}} }
\`\`\`

invoked with the following request:
\`\`\`json
{{=JSON.stringify(it.requestArgs)}}
\`\`\`

we receive below response content:
<--- response begin --->
{{=it.resp}}
<--- response end --->

Please formalize the response content as a single-lined JSON object:
{"status": "the exact response code(integer) defined in API", "data": "extracted response value with respect to the corresponding API response schema, or undefined if abnormal response", "statusText": "status text if abnormal response, otherwise undefined"}
Output:`,
    },
    {
      name: 'summarizeEntry',
      prompt: `## Objectives:
Given below API service{{ if (!it.totally) { }} changes, some added/removed endpoints{{ } }}:, please re-summarize just for the API service \`summary\` and \`instruction\`, for user to quickly know when and how to use this service based only on these 2 fields(you may ignore those trivial endpoints like auth/users/etc, focusing on those that are more business critical)

## Deliverables:
output a single-lined JSON object:
{ "totally": "boolean: {{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service endpoints to re-summarize, else left empty.{{ } }}", "summary": "Concise summary of \`WHEN\`: to let users quickly understand the core business concepts and in what scenarios to use this service(don't mention service name since it may change). leave empty if \`totally\` is true. 3k chars most", "instruction": "Concise instruction of \`HOW\`: to let users know roughly on how to use this service: operations described, etc. leave empty if \`totally\` is true. 3k chars most" }

## Input:
Service \`{{=it.entry.name}}\` { {{ if (it.totally) { }}{{~ it.news : ep }}
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
{{ } else { }}
  summary: '{{=it.entry.summary}}',
  instruction: '{{=it.entry.instruction}}',
  endpoints: { {{ if (it.news && it.news.length) { }}
    existing: {...},
    added: { {{~ it.news : ep }}
      "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
    },{{ } }}{{ if (it.olds && it.olds.length) { }}
    removed: { {{~ it.olds : ep }}
      "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
    },{{ } }}
  }{{ } }}
}

## Output
the json result is:
`,
    },
    {
      name: 'summarizeCallgent',
      prompt: `## Objectives:
Given below API service{{ if (!it.totally) { }} changes, some added/removed entries{{ } }}:, please re-summarize just for the API service \`summary\` and \`instruction\`, for user to quickly know when and how to use this service based only on these 2 fields,

## Deliverables:
output a single-lined JSON object:
{ "totally": "boolean: {{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service entries to re-summarize, else left empty.{{ } }}", "summary": "Concise summary of \`WHEN\`: to let users quickly understand the core business concepts and in what scenarios to use this service(don't mention service name since it may change). leave empty if \`totally\` is true. 3k chars most", "instruction": "Concise instruction of \`HOW\`: to let users know roughly on how to use this service: operations described, etc. leave empty if \`totally\` is true. 3k chars most" }

## Input:
Service \`{{=it.callgent.name}}\` { {{ if (it.totally) { }}{{~ it.news : ep }}
  "Entry#{{=ep.pk}}": {"summary":"{{=ep.summary}}", "instruction":"{{=ep.instruction}}"},{{~}}
{{ } else { }}
  summary: '{{=it.callgent.summary}}',
  instruction: '{{=it.callgent.instruction}}',
  entries: { {{ if (it.news && it.news.length) { }}
    existing: {...},
    added: { {{~ it.news : ep }}
      "Entry#{{=ep.pk}}": {"summary":"{{=ep.summary}}", "instruction":"{{=ep.instruction}}"},{{~}}
    },{{ } }}{{ if (it.olds && it.olds.length) { }}
    removed: { {{~ it.olds : ep }}
      "Entry#{{=ep.pk}}": {"summary":"{{=ep.summary}}", "instruction":"{{=ep.instruction}}"},{{~}}
    },{{ } }}
  }{{ } }}
}

## Output
the json result is:
`,
    },
    {
      name: 'genVue1Route',
      prompt: `Given requirement:
{ "description": "{{=it.requirement}}" }

You need to generate a Vue3+Pinia app for user to interact with backend service APIs:
Service \`{{=it.callgent.name}}\` { "summary": "{{=it.callgent.summary}}", "instruction": "{{=it.callgent.instruction}}", "endpoints": {...} },

There are 6 steps to generate code to fulfil the requirement:
1. generate \`/src/router/index.js\`, only necessary \`views\` for the requirement
2. define necessary Vue \`components\` for each view, associate service endpoints;
3. generate \`/src/components/*.vue\` code, which may import \`/src/stores/*.js\`;
4. generate \`/src/stores/*.js\` used by components, bind \`actions\` to service endpoints.
5. generate \`/src/views/*.vue\` code, which combines several \`/src/components/*.js\`, no any import of \`/src/stores/*.js\`.
6. generate /src/App.vue, /src/main.js

Now let's goto #1, as world-class frontend expert, please design necessary simple view pages, output a single-lined json array of routes:
[{ "name": "just same as component name", "component": "component name, unique in this array, must suffix with 'View'", "path": "route path", "file": "/src/views/{file-name}.vue", "title":"view title", "summary":"brief summary of use cases", "instruction": "Description of interactive prototype(layout, elements, operations, dynamic effects, etc) to guide developer to implement", "distance":"integer to indicate distance of the view to root view, 0 means root" }]`,
    },
    // TODO vue-i18n: src/i18n.js, app.use(i18n);
    {
      name: 'genVue2Components',
      prompt: `For Vue3+Pinia app with views:
[
  {"name":"{{=it.view.name}}","path":"{{=it.view.path}}","file":"{{=it.view.file}}","title":"{{=it.view.title}}","summary":"{{=it.view.summary}}","instruction":"{{=it.view.instruction}}},{{~it.otherViews:ov}}
  {"name":"{{=ov.name}}","path":"{{=ov.path}}","title":"{{=ov.title}}","summary":"{{=ov.summary}}"},{{~}}
],
and existing UI components:
{{=JSON.stringify(it.components)}},

Depending on the installed packages: [{{=it.packages}}], use these components libraries for best practice,
As world-class frontend architect, please design simple components for entire view \`{{=it.view.name}}\`, which are back-ended by service endpoints: [{{~ it.endpoints :ep }}
  { "id": "{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }} },{{~}}
],
Note: all API params are already documented here! Components access them only via store states/actions.

Please refine existing or add new components for view \`{{=it.view.name}}\`, output a single-lined json object:
{ [FormalComponentName: string]: {"file": "/src/components/{file-name}.vue", "endpoints":["endpoint ids(METHOD /resource/url), which **may** be used by the component", "may empty array" ..], "summary":"precise summary to let developers correctly use the component without reading the code!", "instruction": "Description of interactive prototype(layout, elements, operations, dynamic effects, etc) to guide developer to implement. ignore auth logic, which is handled outside of the VUE app" }}
After design before output, please redesign to meet rules:
- Design component simple but as few as possible: don't add new component if existing in installed packages！
- Design component independent: prevent embedding one to another!
- pass data among components only via shared pinia stores, not props/events!
- double check independent requirements: preventing embedding, passing data via stores!
- FormalComponentName must suffix with 'Component'
- strictly prohibit importing any stores into \`{{=it.view.name}}\` view
- using ui components in installed packages is strongly encouraged over creating our own
- Not missing any components or service endpoints for the \`{{=it.view.name}}\` view functionalities, yet make the view as simple as possible
- Not including functionalities from other views, we'll design them later
- component props are prohibited, all state goes into pinia stores
- It's OK to cut functionalities to make components only uses API params listed above!
- if \`endpoints\` empty, please describe brief store actions logic in \`instruction\`
- describe interactive dynamics between components in \`instruction\``,
    },
    //     {
    //       name: 'genVue3Apis',
    //       prompt: `Given proposed UI components of a Vue3+Pinia app: [{{~ it.compsList :comp }}
    //   { "name": "{{=comp.name}}", "props": {{=JSON.stringify(comp.props)}}, "summary":"{{=comp.summary}}", "instruction": "{{=comp.instruction}}" },{{~}}
    // ],

    // Back-ended with the following service APIs:
    // Service \`{{=it.callgent.name}}\` { "summary": "{{=it.callgent.summary}}", "instruction": "{{=it.callgent.instruction}}", "endpoints": [{{~ it.endpoints :ep }}
    //   { "id": "{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters": {{=JSON.stringify(ep.params)}} },{{~}}
    //   ]
    // },

    // As world-class frontend expert, please adjust/remove components to fit APIs params, even if it means reducing the required functionality!
    // Note: all API params are totally listed above!
    // output a single-lined json object:
    // {[ComponentName: string]: {"endpoints":["endpoint ids(METHOD /resource/url), which \`may\` be used by the component", ..], "removed": "mark current component as removed if APIs can't fulfill the functionality, then set component's other attributes to empty.", "props": ["similar to function params. please use store state as possible", "must remove unsupported props, may empty", ..], "summary":"Adjusted summary", "instruction": "Adjusted instruction"} }`,
    //     },
    {
      name: 'genVue3Component',
      prompt: `For Vue3+Pinia app with components structure:
{
  "relatedComponents": {{=JSON.stringify(it.components)}},
  "relatedViews": {{=JSON.stringify(it.relatedViews)}},
  "otherViews": {{=JSON.stringify(it.otherViews)}},
  "existingStores": {{=JSON.stringify(it.stores)}},
  "installedPackages": {{=JSON.stringify(it.packages)}}
};

As world-class frontend expert, please write \`{{=it.components[0].file}}\` full code based on it's instruction and endpoint APIs(especially params).
the component must import relevant \`stores/*.js\` for Pinia models and actions, needn't generate stores code in current step.
output a single-lined json object:
{ "packages":["additional real packages(format: package@version) imported by current file","make sure packages exists!"], "importedComponents":["directly imported components"], "importedStores": [{"file": "/src/stores/{file-name}.js", "name":"the exported store name, must prefix with 'use'", "state": {"State JSON object used by current component, list detailed props used by component for each entity(give example object in each arrays, if prop is complex type(like File),express as string of js). don't list props unused by current component. better use existing, add new if really need"}, "actions": ["Actions(full params/return in ts function signature format) used by current component, especially wrap APIs into actions. better use existing, add new if really need", "don't list actions not used by current component", ..], "getters": [{"name": "name of derived state used by current component", "code": "(state) => { /*full js code to return derived value*/ }"}], ..]}, ..], "spec": {"props":[{"name":"", "type":"primitive types only!; prohibit to bind props with state or variables, only static constant values!"}],"slots":[{"name":"","summary":""}],"importedComponents":["directly imported self-defined ComponentName, only list components from \`/src/components/*.vue\`!"]}, "code": "formatted lines of full(don't ignore any code, since we put the code directly into project without modification) implementation code for \`{{=it.components[0].file}}}\`. pay special attentions to interaction states/error handling/validations; Only access endpoint APIs through store actions" }
after generate before output, please double-check the result json meets all rules:
- all arrays may be \`[]\`, array items must not empty values!
- don't add \`installedPackages\` into $.packages, only new ones; prohibit version conflicts!
- $.state are all simple example instances, make sure all props are affordable from service endpoints
- $.actions is array of strings
- add only derived(need calculation, prohibit just aliases) state into \`getters\`; don't list getters unused by current component; better use existing, add new if really need
- $.code must not any typescript; using components from installed packages are strongly encouraged
- use vue3 best practices; '<template>','<script setup>' is must; don't miss any import items(especially basic items(like 'ElMessage', or others in vue/element-plus))!
- Be most careful don't introduce bugs in code, we'll lose big money for any bug!
- double check output valid json object, especially $.code`,
    },
    {
      name: 'genVue4Store',
      prompt: `For Vue3+Pinia app, please generate \`{{=it.store.file}}\` following the specification:
{{=JSON.stringify(it.store)}};

existing packages: {{=JSON.stringify(it.packages)}};
NOTE: call all API with const apiBaseUrl= '{{=it.apiBaseUrl}}';
As world-class frontend expert, please write the code, output a single-lined json object:
{ "packages":["additional packages(format: package@version) imported by current file, don't list existing/different versioned/unused ones!","make sure packages exists!","may empty array"], "code": "formatted lines of full(don't ignore any code, since we put the code directly into project without modification) implementation js(not ts) code" }.
NOTE:
- strictly prohibit import any stores in view, so stores are only accessed among components!
- don't add \`installedPackages\` into $.packages, only new ones; prohibit version conflicts!
- Be most careful don't introduce bugs in code, we'll lose big money for any bug!`,
    },
    {
      name: 'genVue5View',
      prompt: `For Vue3+Pinia app, please generate \`{{=it.view.file}}\` following the specification:
{
  "view": {{=JSON.stringify(it.view)}},
  "otherViews": {{=JSON.stringify(it.otherViews)}}
},
Involved components in current view page: {{=JSON.stringify(it.components)}};
existing packages: {{=JSON.stringify(it.packages)}};

As world-class frontend expert, please write the code, output a single-lined json object:
{ "packages":["additional packages(format: package@version) imported by current file, don't list existing/different versioned/unused ones!","make sure packages exists!","may empty array"], "code": "formatted lines of full(don't ignore any code, since we put the code directly into project without modification) implementation js code" }.
NOTE
- strictly prohibit importing any stores in this view, only assemble components, they already interact via shared pinia stores!
- Be most careful don't introduce bugs in code, we'll lose big money for any bug!
- use vue3 best practices; '<template>','<script setup>' is must
- don't repeat components imported in sepc.importedComponents`,
    },
  ];

  return llmTemplates.map((llmTpl) =>
    (console.log(llmTpl.name, 'llmTemplate.length,', llmTpl.prompt.length),
    prisma.llmTemplate.upsert({
      where: { name: llmTpl.name },
      update: llmTpl,
      create: llmTpl,
    })).then((llmTpl) => console.log({ llmTpl })),
  );
}
function initTags(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) {
  const tags: Prisma.TagUncheckedCreateInput[] = [
    {
      pk: -1,
      name: 'Unlabelled',
      description: 'APIs that do not fall into any specific category',
    },
    {
      name: 'App Security',
      description:
        'APIs to enhance the security of applications by protecting them from various cybersecurity threats',
    },
    {
      name: 'Artificial Intelligence',
      description:
        'Ready to use APIs to add Artificial intelligence capabilities to your app such as predictive analysis, bots, and language conversions',
    },
    {
      name: 'Communication',
      description:
        'APIs enabling the exchange of information and news via messaging, meetings, push notifications, survey forms',
    },
    {
      name: 'Data Analytics',
      description:
        'APIs enabling seamless data generation, processing, analysis, and visualization',
    },
    {
      name: 'Database',
      description:
        'Discover public APIs to retrieve data and work with databases',
    },
    {
      name: 'Developer Productivity',
      description:
        'Must-fork APIs to improve productivity during the software development lifecycle and fasten the execution process',
    },
    {
      name: 'DevOps',
      description:
        'APIs to enable quick CI/CD, build automation, containerization, config management during code deployment process',
    },
    {
      name: 'E-commerce',
      description:
        'Ready to use APIs to streamline online shopping, logistics, catalogs, and inventory management to create exceptional e-commerce applications.',
    },
    {
      name: 'eSignature',
      description:
        'Handpicked APIs for seamless e-signatures and document signing, empowering developers to build exceptional applications.',
    },
    {
      name: 'Financial Services',
      description:
        'Banking and stock market APIs for managing personal finance, real-time trading and integrating with financial institutions',
    },
    {
      name: 'Payments',
      description:
        'APIs to seamlessly integrate and manage payments in your apps',
    },
    {
      name: 'Travel',
      description: 'Exciting Travel APIs for seamless retrieval of real',
    },
  ];

  return tags.map((t) =>
    prisma.tag.upsert({
      where: { name: t.name },
      update: t,
      create: t,
    }),
  );
}
function initModelPricing(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) {
  let pk = 1;
  const llmModels: Prisma.ModelPricingCreateInput[] = [
    {
      pk: pk++,
      model: 'deepseek-chat',
      alias: 'deepseek-V3',
      price: {
        pricePerInputToken: 0.27e11,
        pricePerOutputToken: 1.1e11,
        pricePerCacheHitToken: 0.07e11,
        token: 1e6,
      },
      currency: 'USD',
      method: `(u, p)=> {
  const pit = u.prompt_cache_miss_tokens * p.pricePerInputToken / p.token;
  const pot = u.completion_tokens * p.pricePerOutputToken / p.token;
  const pct = u.prompt_cache_hit_tokens * p.pricePerCacheHitToken / p.token;
  return pit + pot + pct;
}`,
    },
    {
      pk: pk++,
      model: 'google/gemini-2.0-flash-001',
      price: {
        pricePerInputToken: 0.1e11,
        pricePerOutputToken: 0.4e11,
        token: 1e6,
      },
      currency: 'USD',
      method: `(u, p)=> {
  const pit = u.prompt_tokens * p.pricePerInputToken / p.token;
  const pot = u.completion_tokens * p.pricePerOutputToken / p.token;
  return pit + pot;
}`,
    },
  ];

  return llmModels.map((llmModel) =>
    prisma.modelPricing
      .upsert({
        where: { pk: llmModel.pk },
        update: llmModel,
        create: llmModel,
      })
      .then((llmModelPricing) => console.log({ llmModelPricing })),
  );
}
