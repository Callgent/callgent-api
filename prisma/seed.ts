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
      id: 'CR-INVOKE-SEP',
      srcId: '*',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'InvokeService',
      funName: 'invokeSEPs',
      description: 'Do actual invocation through the SEP adaptor',
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
      prompt: `You are an expert in analyzing OpenAPI documents and understanding user requirements. Your task is to help the user identify which APIs from the provided OpenAPI document are necessary to orchestrate a script to fulfill user task goal.
1. Understand the Requirements: Carefully read the conversations and comprehend the user's requirements
2. Analyze the OpenAPI Document: Review the provided OpenAPI document to understand the available endpoints, their functionalities, request parameters, and response structures
3. Match Requirements to APIs: Identify which APIs from the OpenAPI document are relevant to the user's requirements, don't imagine non-existing endpoint!
4. Explain the Purpose: For each identified API, explain its purpose and how it meets the user's needs
5. It's very likely there is not enough APIs to fulfill user requirements, place the purposes into \`unaddressedAPI\` list
6. output complete purposes in json format:
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

**Guidelines**:
- Be precise and detailed in your analysis, to ensure the output list can fulfill all user's requirements
- it's ok if some chosen endpoints are not finally used
- **Don't** choose wrong endpoints which may cause unexpected loss, better miss than wrong!
- \`epName\` must exist in \`The given service endpoint APIs\`, better empty than fake!

## The given service endpoint APIs:
\`\`\`json
{
  "serviceName": "{{=it.callgent.name}}",
  "summary":"{{=it.callgent.summary}}",
  "instruction":"{{=it.callgent.instruction}}",
  "endpoints": [{{~ it.endpoints :ep }}
    {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
  ]
}
\`\`\`{{ if (it.files) { }}

## User uploaded files
files are in current dir \`.\` of local disk, you may directly access them if needed:
\`\`\`json
{{=JSON.stringify(it.files)}}
\`\`\`{{ } }}`,
    },
    {
      name: 'reChooseEndpoints',
      prompt: `You are an expert in analyzing OpenAPI documents and understanding user requirements. Your task is to help the user identify which APIs from the provided OpenAPI document are necessary to orchestrate a script to fulfill user task goal.
1. Understand the Requirements: Carefully read the conversations and comprehend the user's requirements
2. Analyze the OpenAPI Document: Review the provided OpenAPI document to understand the available endpoints, their functionalities, request parameters, and response structures
3. Examine the split \`usedFor\` purposes: Are the purposes complete enough to meet all user requirements
4. Address which endpoint is best suited for each \`usedFor\` purpose, don't imagine **non-existing** endpoint!
5. It's very likely there is no appropriate endpoint for \`usedFor\` purpose, move it from \`usedEndpoints\` into \`unaddressedAPI\` list
6. output complete purposes in json format:
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

**Guidelines**:
- Be precise and detailed in your analysis, to ensure the output list can fulfill all user's requirements
- it's ok if some chosen endpoints are not finally used
- **Don't** choose wrong endpoints which may cause unexpected loss, better miss than wrong!
- Double check \`epName\` exists in \`The given service endpoint APIs\`, better empty than fake!

## The split \`usedFor\` purposes to fulfill user goal:
\`\`\`json
{{=JSON.stringify(it.purposes)}}
\`\`\`

## The given service endpoint APIs:
\`\`\`json
{
  "serviceName": "{{=it.callgent.name}}",
  "summary":"{{=it.callgent.summary}}",
  "instruction":"{{=it.callgent.instruction}}",
  "endpoints": [{{~ it.endpoints :ep }}
    {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
  ]
}
\`\`\`{{ if (it.files) { }}

## User uploaded files
files are in current dir \`.\` of local disk, you may directly access them if needed:
\`\`\`json
{{=JSON.stringify(it.files)}}
\`\`\`{{ } }}`,
    },
    {
      name: 'confirmEndpoints',
      prompt: `Analyze the provided user requirements in conversation, and the split purposes per API perspective to achieve the user requirements goals,

## Objectives:
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

Ensure accuracy and avoid assumptions outside the provided data.

## Input Details:

### Per API Perspective Split Purposes:
\`\`\`json
{{=JSON.stringify(it.purposes)}}
\`\`\`

### The given service endpoint APIs:
\`\`\`json
{
  "serviceName": "{{=it.callgent.name}}",
  "summary":"{{=it.callgent.summary}}",
  "instruction":"{{=it.callgent.instruction}}",
  "endpoints": [{{~ it.endpoints :ep }}
    {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
  ]
}
\`\`\`{{ if (it.files) { }}

### User uploaded files
files are in current dir \`.\` of local disk, you may directly access them if needed:
\`\`\`json
{{=JSON.stringify(it.files)}}
\`\`\`{{ } }}`,
    },
    {
      name: 'confirmEndpointsArgs',
      prompt: `Analyze user requirements from conversations and uploaded files alongside the chosen OpenAPI endpoints. Evaluate the inputs for sufficiency and identify any missing parameters necessary to fulfill the task.

### Input:
1. **User Requirements**: All Information is already provided in conversations for user task goal. Please Don't make assumption on any missing info, ask the user directly
2. **Chosen OpenAPI Endpoints**: A list of endpoints needed to fulfill the user requirements:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`
3. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
   \`\`\`json
   {
     "serviceName": "{{=it.callgent.name}}",
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`{{ if (it.files) { }}
4. **User uploaded files**: files are placed in current dir \`.\` of local disk, directly accessed by script code if needed:
   \`\`\`json
   {{=JSON.stringify(it.files)}}
   \`\`\`{{ } }}

### Objectives:
Your goal is to:
1. Extract all required arguments from user information to prepare for invoking the endpoints:
2. Identify gaps where:
   - **Missing information**: User-provided information is insufficient to invoke chosen endpoints
   - **Ambiguous**: user provided info is unclear or contradictory
   - **Missing conversion**: args info is sufficient, but additional mapping-dictionaries or APIs are required(but absent) to convert the user data into endpoint parameter type/value, e.g.: mapping to enumerations, converting name to entity ID, converting keys to values, etc

### Deliverables:
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

#### Notes:
- Ensure endpoint purposes match user goals precisely
- Ensure all arg values are sourced from real data as user provided. Do not use imaginary/fake/example/mock/test data as arg values
  - There must be at least one source for each argument
- One arg may have multiple sources. remove json node flagged as false`,
    },
    {
      name: 'reConfirmEndpointsArgs',
      prompt: `Analyze user requirements from conversations and uploaded files alongside the chosen OpenAPI endpoints. Evaluate the inputs for sufficiency and identify any missing parameters necessary to fulfill the task.

### Input:
1. **User Requirements**: All Information is already provided in conversations for user task goal. Please Don't make assumption on any missing info, ask the user directly
2. **Chosen OpenAPI Endpoints**: A list of endpoints needed to fulfill the user requirements:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`
3. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
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
4. **Uncertain Endpoint arguments to Analyze**:
   \`\`\`json
   {{=JSON.stringify(it.reConfirmArgs)}}
   \`\`\`{{ if (it.files) { }}
5. **User uploaded files**: files are placed in current dir \`.\` of local disk, directly accessed by script code if needed:
   \`\`\`json
   {{=JSON.stringify(it.files)}}
   \`\`\`{{ } }}

### Objectives:
Your goal is to:
1. Analyze the **Uncertain** args to prepare for invoking the endpoints:
2. Identify gaps where:
   - **Missing information**: User-provided information is insufficient to invoke chosen endpoints
   - **Ambiguous**: user provided info is unclear or contradictory
   - **Missing conversion**: args info is sufficient, but additional mapping-dictionaries or APIs are required(but absent) to convert the user data into endpoint parameter type/value, e.g.: mapping to enumerations, converting name to entity ID, converting keys to values, etc

### Deliverables:
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

#### Notes:
- Only analyze the **Uncertain** args, which are not clear or contradictory, or missing conversion
- Ensure all arg values are sourced from real data as user provided. Do not use imaginary/fake/example/mock/test data as arg values
  - There must be at least one source for each argument
- One arg may have multiple sources. remove json node flagged as false`,
    },
    {
      name: 'analyzeEdgeCases',
      prompt: `You are a software assistant focused on API integration and edge case analysis. Given user requirements from conversations and uploaded files alongside the chosen OpenAPI endpoints.

### Input:
1. **User Requirements**: All Information is already provided in conversations for user task goal. Please Don't make assumption on any missing info, ask the user directly
2. **Chosen OpenAPI Endpoints**: A list of endpoints needed to fulfill the user requirements:
   \`\`\`json
   {{=JSON.stringify(it.purposes)}}
   \`\`\`
3. **OpenAPI Documentation**: documentation for the backend service of chosen endpoints:
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
4. **Endpoint Argument Hints**:
   \`\`\`json
   {{=JSON.stringify(it.argsHints)}}
   \`\`\`{{ if (it.files) { }}
5. **User uploaded files**: files are placed in current dir \`.\` of local disk, directly accessed by script code if needed:
   \`\`\`json
   {{=JSON.stringify(it.files)}}
   \`\`\`{{ } }}

### Objectives:
Analyze each endpoint edge cases which need additional code logic required to handle:
- **Input edge value validation**: Determine and describe edge cases for each parameter used by the endpoint.
- **Output edge values and exceptions**: Identify edge cases in the responses and exceptions returned by the endpoint.
- **Service side-effects and stateful edge conditions**: Examine side effects and stateful conditions (e.g., database changes, resource locks).

### Deliverables:
Output the argument sourcing in JSON format:
\`\`\`json
[{
  "purposeKey": "", "edgeCaseKey": "", "priority":"int: 0~4, 0-highest",
  "description": "",
  "handleLogic": "",
  "additionalEndpoint":"description of additional endpoint needed for this edge case. leave empty if needn't",
},..]
\`\`\`  

#### Notes:
- Provide a detailed description of the identified edge cases and their handling logic, including suggestions for validation or recovery steps.
- Ignore and exclude edge cases that require no handling or can safely terminate execution without impacting the overall process.
  - You may also ignore whose simple cases such as null value check
  - Ignore cases which can not be handled by code, e.g. cases need reading doc
- Ensure clarity and conciseness in describing the edge cases and handling logic`,
    },
    {
      name: 'dddServiceDesign',
      prompt: `You are a Domain-Driven Design expert and TypeScript architect. Your role is to:

### Objectives:
1. Analyze the provided task requirements in conversation, associated files (if any), and related REST APIs to:
   - Identify key business entities and their relationships.
   - Consolidate related entities and functionality into **minimal aggregate roots**:
     - Consider **logical**, **validation**, and **resource-based exceptional scenarios** to guide aggregate boundaries.
     - Ensure aggregates encapsulate business invariants and maintain transaction consistency.
     - Minimize the number of aggregate roots to reduce complexity.

2. Design **anemic domain-driven services**:
   - Define clear service boundaries aligned with aggregate roots.
   - Group related operations into cohesive services that reflect business capabilities.
   - Address exceptional scenarios within service interfaces:
     - Logical exceptions (e.g., conflicting business rules).
     - Validation issues (e.g., malformed inputs or constraint violations).
     - Resource-based exceptions (e.g., unavailability of dependent services).
   - Focus on service interfaces and operations, avoiding implementation details.

3. Create a **TypeScript task orchestration script**:
   - Use the designed services to fulfill the specified task requirements.
   - Handle success and failure scenarios with proper error handling and retries.
   - Maintain transaction consistency and use async/await patterns.
   - Include necessary type definitions and manage all identified edge cases.


### Deliverables:
1. **Service Design**:
   - A list of identified aggregate roots with justifications.
   - Designed service interfaces including:
     - Service name and purpose.
     - Key operations/methods with input/output contracts.
     - Dependencies between services.
     - Consideration of edge cases, exceptional scenarios, and recovery strategies.

2. **Orchestrated Script**:
   - A complete TypeScript script demonstrating how to use the services to fulfill the task.
   - Incorporate proper error handling, transaction management, and async/await usage.

### Key Considerations:
- Minimize aggregate roots by consolidating related entities, ensuring they reflect business invariants and scenarios.
- Design services to simplify operations and minimize interdependencies.
- Incorporate edge cases, resource unavailability, and error handling in the design and script.
- Ensure scalability, maintainability, and robustness.

By considering exceptional scenarios during aggregate root identification, ensure your design is both resilient and aligned with business requirements. Your output should reflect these principles for a robust, maintainable solution.

### Input Details:
#### Service Documentation of **Related APIs**:
\`\`\`json
{
  "serviceName": "{{=it.callgent.name}}",
  "summary":"{{=it.callgent.summary}}",
  "instruction":"{{=it.callgent.instruction}}",
  "endpoints": [{{~ it.endpoints :ep }}
    {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
  ],
  "usedEndpoints": {{=JSON.stringify(it.usedEndpoints)}}{{ if (it.unsureArgs){ }},
  "hintsOnSomeArgs": {{=JSON.stringify(it.unsureArgs)}}{{ } }}
}
\`\`\`{{ if (it.files) { }}

#### **User uploaded files**:
all in current dir \`.\` of local disk:
\`\`\`json
{{=JSON.stringify(it.files)}}
\`\`\`{{ } }}`,
    },
    {
      name: 'optimisticProcessDesign',
      prompt: `You are an expert in OpenAPI 3.0 standards and implementation design. Your task is to generate a detailed OpenAPI 3.0 endpoint specification and corresponding pseudocode implementation logic based on the user's provided request details, supplemental descriptions, chosen OpenAPI endpoints to fulfill the user's goal, and hints for argument extraction.

## **Input Details**:
1. **User's Requirement Description**: A clear description of the user's goal and required functionality in conversations
   - **User Conversations**: Conversations of user and assistant to clarify user's goal and requirements{{ if (it.files) { }}
   - **User uploaded files**: files needed to process to achieve user goal, all in current dir \`.\` of local disk
   \`\`\`json
   {{=JSON.stringify(it.files)}}
   \`\`\`{{ } }}
2. **Selected Endpoints{{ if (it.unsureArgs){ }} and some argument hints**{{ } }}:
   - **Selected OpenAPI Endpoints**: A list of relevant endpoints with their purpose and possible use cases{{ if (it.unsureArgs){ }}
   - **Hints on Argument Extraction**: Guidance on how some arguments are derived, including their sources{{ } }}
   \`\`\`json
   {
     "usedEndpoints": {{=JSON.stringify(it.usedEndpoints)}}{{ if (it.unsureArgs){ }},
     "hintsOnSomeArgs": {{=JSON.stringify(it.unsureArgs)}}{{ } }}
   }
   \`\`\`
3. **Documentation of Selected Endpoints**: API spec for service \`{{=it.callgent.name}}\`:
   \`\`\`json
   {
     "summary":"{{=it.callgent.summary}}",
     "instruction":"{{=it.callgent.instruction}}",
     "endpoints": [{{~ it.endpoints :ep }}
       {"epName":"{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
     ]
   }
   \`\`\`

## **Your Output**:
1. **OpenAPI Endpoint Specification**: A valid OpenAPI 3.0 endpoint definition tailored to fulfill the user's goal. Ensure that:
   - The \`path\`, \`method\`, \`parameters\`(may empty) and \`RequestBody\`(may undefined) match the provided requirements and hints
   - Responses reflect realistic success and error scenarios
2. **Pseudocode Implementation**  
   Design pseudocode as a stateless script class that only for user goal execution, the script class contains:
   - **\`execute\` Entry Function**: This is the only controller function for the \`spec\` endpoint, to execute the overall process and combine the logic into a single workflow
     - parameters/requestBody/responses must be consistent with the OpenAPI endpoint specification
   - **predefined \`invokeService\` function**: helper function to handle API calls
     - **fixed signature**: \`invokeService(epName: string, epArgs:object): Promise<any>\`
     - **Predefined**: you needn't output it, just use it
   - **Helper Functions**: To handle specific steps, such as argument extraction, API calls, and response validation
   - **No member variables**: The pseudocode should be stateless
   - **Output file**: if user requires outputting file, save it directly at current dir \`.\`, and return the file name in response, so user can download it
     - else undefined

Include comprehensive validation details, such as the \`epName\` for each API call, parameter names, expected results, and failure conditions.

### **Format**:
**Output Format**:
\`\`\`json
{
  "spec": {
    "operationId": "Unique identifier for this endpoint, please be more specific to prevent potential conflict",
    "method": "rest API method",
    "parameters": ["may empty"{{ if (it.files) { }}, "include user uploaded file names as normal parameters, if needed to be processed by script"{{ } }}],
    "requestBody": {"openAPI requestBody, if not needed, set as empty object"},
    "responses": {..}
  },
  "args": {
    "parameters": { "[name]": "Value extracted based on user provided into or hints{{ if (it.files) { }}, include user uploaded file names as normal parameters, if needed to be processed by script{{ } }}" },
    "requestBody": "Value extracted from the user-provided details(may undefined)"
  },
  "pseudoCode": {
    [helperFunctionName: string]: {
      "signature": {"doc":"documentation for this helper function", "parameters": [{"name":"param name","doc":"","type":"function params in openAPI format"}], "returns": {"doc":"","type":"function return type in openAPI format"}, "exceptions": ["ExceptionType1",..]},
      "lines": [{
        "line":"Step-by-step typescript pseudocode as array of lines; don't use constant value/file name directly extracted from user provided info, instead pass it in as parameters from the \`signature\`",
        "helperInvoked":{
          "name":"Helper function invoked in this step line, function must exists in pseudoCode. may empty",
          "args":{[argName]:{"valueFrom":"var **name** defined in previous \`varsDefined\` or \`signature.parameters\`; or just hardcoded value, instead of var name","isName":"boolean: true if \`valueFrom\` is var name"}}
        },
        "varsDefined":["local variables or constants names defined in this step line. including loop vars, if any", "may empty"],
        "outFile":"Output file name only if user wants to download. If multiple files generated, please zip into one and just return the zip file name). may empty"
      }]
    }
  }
}
\`\`\`

### **Important Instructions**:
- Values extracted from user provided info must not go directly into pseudocode as **constants**; instead it must be declared in \`spec\` parameters/requestBody!
- Match all values of the \`args\` to the schema defined in the \`spec\`{{ if (it.files) { }}
  - include user uploaded file names as normal parameters, if needed to be processed by script{{ } }}
  - Ensure that all \`args\` values are sourced from real data as user provided. Do not use mock/fake/example/imaginary data
- Write pseudocode that is easy to follow and directly maps to the user's objective
  - at least one helper function named \`execute\` must be generated, whose signature must match the \`spec\` endpoint
    - you may define more helpers to be invoked by \`execute\`, to make the pseudocode more modular
  - Don't use \`args\` directly in pseudocode, instead pass it in as proper parameters from the \`execute.signature.parameters\`
  - \`invokeService\` is predefined, don't generate it. yet you need it to invoke \`usedEndpoints\`
    - \`epName\` must match the original name in \`usedEndpoints\`, specify path vars in \`epArgs\`
    - set \`epArgs.requestBody\` if applicable
  - please output correct \`valueFrom\` in \`helperInvoked\` args. we cross check it with defined params/vars{{ if (it.files) { }}
    - if arg value is assembled from several vars/values, defined it as a new local var in pre-step
  - read files from current dir \`.\` to process in pseudocode, if needed{{ } }}`,
    },
    //     {
    //       name: 'askEndpointsArgs',
    //       prompt: `# Confirm chosen service API endpoints is enough to fulfill user request goal

    // ## Your task
    // Given
    // - \`user requests\`
    // - the \`chosen endpoints\` trying to fulfill user request goal
    // - the API \`endpoints\` doc of production running services{{ if (it.askArgs.length) { }}
    // - some \`unsure args\` that may need to confirm from user{{ } }}

    // your task is to:
    // 1. understand what goal user really wants to achieve
    // 2. make sure the chosen endpoints are enough to achieve the user goal, or you may add more endpoints!
    // 3. ask questions to user if user goal noe clear, or args info is absent to invoke chosen endpoints, or any problems achieving user goal

    // ## {{ if (it.histories?.length) { }}user offering more info{{ }else{ }}current user request{{ } }}:
    // \`\`\`json
    // {
    // "requested from": "{{=it.cenAdaptor}}",
    // "request_object": {{=JSON.stringify(it.req)}},
    // }
    // \`\`\`{{ if (it.req.files?.length) { }}
    // > Note: the files are in current dir, you may access them if needed.{{ } }}

    // ## service endpoints:
    // \`\`\`pseudo-openAPI-3-doc
    // { "Service Name": "{{=it.callgentName}}", "endpoints": { {{~ it.endpoints :ep }}
    //   "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
    // }
    // \`\`\`

    // ## chosen endpoints for user goal:
    // \`\`\`json
    // {{=JSON.stringify(it.usedEndpoints)}}
    // \`\`\`
    // {{ if (it.askArgs.length) { }}
    // ## Unsure args:
    // \`\`\`json
    // {{=JSON.stringify(it.askArgs)}}
    // \`\`\`{{ } }}

    // ## output task result in json format:
    // \`\`\`json
    // {
    //   "usedEndpoints": [{"epName":"confirmed chosen endpoints to be invoked, it's ok to list if not finally used", "usedFor":"description of functions related to user goal"},...],
    //   "question": "the question to ask user to confirm user goal or provide more info of listed args. you must leave this field empty if no question needed, so we go on proceed!",
    // }
    // \`\`\``,
    //     },
    {
      name: 'designProcess',
      prompt: `# Task goal:
generating js macro class to orchestrate the given service API endpoints to fulfill the user request

## user request:
\`\`\`javascript
const request = {
{{ if (it.epName) { }}"requesting endpoint": "{{=it.epName}}",
{{ } }}"requested from": "{{=it.cenAdaptor}}",
"request_object": {{=JSON.stringify(it.req)}},
}
\`\`\`
{{ if (it.req.files?.length) { }}> Note: the files are in current dir, you may access them if needed.
{{ } }}
## service endpoints:
\`\`\`pseudo-openAPI-3-doc
{ "Service Name": "{{=it.callgentName}}", "endpoints": { {{~ it.endpoints :ep }}
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
}
\`\`\`

## generated js class template:
\`\`\`javascript
/** stateless class */
class RequestMacro {
  /** @param serviceInvoke - function to invoke a service endpoint */
  constructor(serviceInvoke){ this.serviceInvoke=serviceInvoke; }
  /** must have this starting member function */
  main = (requestArgs, context) => {
    // ...

    // every endpoint invocation goes like this:
    const r = await this.serviceInvoke(epName, epArgs);
    const cbMemberFun = '..'; // meaningful RequestMacro member function name, related to epName, ends with 'Cb', e.g. 'getPetByIdCb'
    if (r.statusCode == 2) return {...r, cbMemberFun}
    // else sync call the same logic
    return this[cbMemberFun](r.data, context)
  };

  // ... more member functions for service endpoints to callback
}
\`\`\`

## serviceInvoke signature:
function(endpointName, epArgs): Promise<{statusCode:2, message}|{data}>}
@returns:
- {statusCode:2, message}: means async endpoint invocation, you must immediately return {cbMemberFun:'macro member function which will be async called by endpoint with successful response object'}
- {data}: errors already thrown on any endpoint failure invocation in serviceInvoke, so you just get successful response object here

**note**: every serviceInvoke may return statusCode 2, so we break the whole logic into member functions

## all member functions(including \`main\`) have same signature:
function(asyncResponse: any, context:{ [varName:string]:any }): Promise<{cbMemberFun,message}|{data?,statusCode?,message?}>
@param asyncResponse
- for RequestMacro.main: it's requestArgs, matching macroParams schema
- for any other member functions: it's received endpoint successful response object of previous endpoint invocation
@param context: the same context object passes through out all member invocations, keeping shared state
@returns
- {cbMemberFun,message}: tell endpoint to callback \`cbMemberFun\` later
- {data:'user request's final response, matching one of macroResponse schema',statusCode:'corresponding http-code',message?}

## generated code output json format:
\`\`\`json
{ "question": "question to ask the user, if any information not sure or missing while mapping from request to main#requestArgs, *no* guess or assumption of the mapping. set to '' if the args mapping is crystal clear. if question not empty, leave all subsequent props(endpoints, macroParams,..) empty",
  "endpoints": ["the chosen endpoint names to be invoked"], "summary":"short summary to quickly understand what RequestMacro does", "instruction":"Instruction helps using this service",
  "macroParams":"schema of main#requestArgs, a formal openAPI format json: {parameters?:[], requestBody?:{"content":{[mediaType]:..}}}", "macroResponse": "schema of final response of the user request, a formal openAPI format json {[http-code]:any}",
  "requestArgs": "k-v dto following $.macroParams schema(no additional props than $.macroParams defined! optional props can be omitted, default values can be used). all values are semantically extracted from \`request.request_object\`",
  "memberFunctions": { "main":"full js function implementation code, the code must have not any info from request.request_object, all request info just from requestArgs", [callbackFunName:string]:"full js function code. async service endpoints will callback to these functions with real response" }
}
\`\`\`
**note**:
1. extract all values matching macroParams schema, from user request_object into \`requestArgs\`, don't put as constant in code! requestArgs must valid json value.
2. this is real production service invocations, please don't use mock/fake/guess data as \`requestArgs\`. if info absent/ambiguous, you may:
   - try best to retrieve the info by invoking service endpoints if possible
   - or ask user to provide from $.question
   - before asking user, double check if it's really not possible to retrieve from request_object or endpoints invocations!
3. if $.question is not empty, set all other prop values empty!
4. \`requestArgs\` will be passed to main(requestArgs, context) as the first argument
5. you may use \`context\` to pass any shared state between member functions; requestArgs is already shared as \`context.requestArgs\`, you needn't put it again!
6. each member function should have only 0 or 1 \`serviceInvoke\` invocation, it's response data must be handled in another member function, because of r.statusCode == 2! so use the template code at end of each member function: const cbMemberFun='..';if (r.statusCode == 2) return {...r, cbMemberFun} else return this[cbMemberFun](r.data, context)
7. \`memberFunctions.keys()\` returns all member function names of \`RequestMacro\`, \`memberFunctions.values()\` are implementation code(please escape newline char so code is valid string in json) for each function. don't print whole class!
8. member functions signature is fixed, please don't change it, use context to pass states!
9. robust code to handle errors/abnormal vars/timeout/retries`,
    },

    {
      name: 'generateMacroCode',
      prompt: `# Task goal:
generating js macro class to orchestrate the given service API endpoints to fulfill the user request

## user request:
\`\`\`javascript
const request = {
{{ if (it.epName) { }}"requesting endpoint": "{{=it.epName}}",
{{ } }}"requested from": "{{=it.cenAdaptor}}",
"request_object": {{=JSON.stringify(it.req)}},
}
\`\`\`
{{ if (it.req.files?.length) { }}> Note: the files are in current dir, you may access them if needed.
{{ } }}
## service endpoints:
\`\`\`pseudo-openAPI-3-doc
{ "Service Name": "{{=it.callgentName}}", "endpoints": { {{~ it.endpoints :ep }}
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(ep.responses)}} },{{~}}
}
\`\`\`

## generated js class template:
\`\`\`javascript
/** stateless class */
class RequestMacro {
  /** @param serviceInvoke - function to invoke a service endpoint */
  constructor(serviceInvoke){ this.serviceInvoke=serviceInvoke; }
  /** must have this starting member function */
  main = (requestArgs, context) => {
    // ...

    // every endpoint invocation goes like this:
    const r = await this.serviceInvoke(epName, epArgs);
    const cbMemberFun = '..'; // meaningful RequestMacro member function name, related to epName, ends with 'Cb', e.g. 'getPetByIdCb'
    if (r.statusCode == 2) return {...r, cbMemberFun}
    // else sync call the same logic
    return this[cbMemberFun](r.data, context)
  };

  // ... more member functions for service endpoints to callback
}
\`\`\`

## serviceInvoke signature:
function(endpointName, epArgs): Promise<{statusCode:2, message}|{data}>
@returns:
- {statusCode:2, message}: means async endpoint invocation, you must immediately return {cbMemberFun:'macro member function which will be async called by endpoint with successful response object'}
- {data}: errors already thrown on any endpoint failure invocation in serviceInvoke, so you just get successful response object here

**note**: every serviceInvoke may return statusCode 2, so we break the whole logic into member functions

## all member functions(including \`main\`) have same signature:
function(asyncResponse: any, context:{ [varName:string]:any }): Promise<{cbMemberFun,message}|{data?,statusCode?,message?}>
@param asyncResponse
- for RequestMacro.main: it's requestArgs, matching macroParams schema
- for any other member functions: it's received endpoint successful response object of previous endpoint invocation
@param context: the same context object passes through out all member invocations, keeping shared state
@returns
- {cbMemberFun,message}: tell endpoint to callback \`cbMemberFun\` later
- {data:'user request's final response, matching one of macroResponse schema',statusCode:'corresponding http-code',message?}

## generated code output json format:
\`\`\`json
{ "question": "question to ask the user, if any information not sure or missing while mapping from request to main#requestArgs, *no* guess or assumption of the mapping. set to '' if the args mapping is crystal clear. if question not empty, leave all subsequent props(endpoints, macroParams,..) empty",
  "endpoints": ["the chosen endpoint names to be invoked"], "summary":"short summary to quickly understand what RequestMacro does", "instruction":"Instruction helps using this service",
  "macroParams":"schema of main#requestArgs, a formal openAPI format json: {parameters?:[], requestBody?:{"content":{[mediaType]:..}}}", "macroResponse": "schema of final response of the user request, a formal openAPI format json {[http-code]:any}",
  "requestArgs": "k-v dto following $.macroParams schema(no additional props than $.macroParams defined! optional props can be omitted, default values can be used). all values are semantically extracted from \`request.request_object\`",
  "memberFunctions": { "main":"full js function implementation code, the code must have not any info from request.request_object, all request info just from requestArgs", [callbackFunName:string]:"full js function code. async service endpoints will callback to these functions with real response" }
}
\`\`\`
**note**:
1. extract all values matching macroParams schema, from user request_object into \`requestArgs\`, don't put as constant in code! requestArgs must valid json value.
2. this is real production service invocations, please don't use mock/fake/guess data as \`requestArgs\`. if info absent/ambiguous, you may:
   - try best to retrieve the info by invoking service endpoints if possible
   - or ask user to provide from $.question
   - before asking user, double check if it's really not possible to retrieve from request_object or endpoints invocations!
3. if $.question is not empty, set all other prop values empty!
4. \`requestArgs\` will be passed to main(requestArgs, context) as the first argument
5. you may use \`context\` to pass any shared state between member functions; requestArgs is already shared as \`context.requestArgs\`, you needn't put it again!
6. each member function should have only 0 or 1 \`serviceInvoke\` invocation, it's response data must be handled in another member function, because of r.statusCode == 2! so use the template code at end of each member function: const cbMemberFun='..';if (r.statusCode == 2) return {...r, cbMemberFun} else return this[cbMemberFun](r.data, context)
7. \`memberFunctions.keys()\` returns all member function names of \`RequestMacro\`, \`memberFunctions.values()\` are implementation code(please escape newline char so code is valid string in json) for each function. don't print whole class!
8. member functions signature is fixed, please don't change it, use context to pass states!
9. robust code to handle errors/abnormal vars/timeout/retries`,
    },
    {
      name: 'convert2Response',
      prompt: `Given the openAPI endpoint:
{"endpoint": "{{=it.ep.name}}""{{=it.ep.summary?', "summary":'+it.ep.summary:''}}", {{=it.ep.description ? '"description":"'+it.ep.description+'", ':''}}"parameters":{{=JSON.stringify(ep.params.parameters)}}, {{ if (ep.params.requestBody) { }}"requestBody":{{=JSON.stringify(ep.params.requestBody)}}, {{ } }}"responses":{{=JSON.stringify(it.ep.responses)}} }

invoked with the following request:
<--- request begin ---
{{=JSON.stringify(it.requestArgs)}}
--- request end --->

we receive below response content:
<--- response begin ---
{{=it.resp}}
--- response end --->

Please formalize the response content as a single-lined JSON object:
{"statusCode": "the exact response code(integer) defined in API", "data": "extracted response value with respect to the corresponding API response schema, or undefined if abnormal response", "error": "message": "error message if abnormal response, otherwise undefined"}`,
    },
    {
      name: 'summarizeEntry',
      prompt: `Given below API service{{ if (!it.totally) { }} changes: some added/removed endpoints{{ } }}:
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
};
Please re-summarize just for service \`summary\` and \`instruction\`, for user to quickly know when and how to use this service based only on these 2 fields(you may ignore those trivial endpoints like auth/users/etc, focusing on those that are more meaningful to users):,
output a single-lined JSON object:
{ "totally": "boolean,{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service endpoints to re-summarize, else left empty.{{ } }}", "summary": "Concise summary to let users quickly understand the core business concepts and in what scenarios to use this service. leave empty if \`totally\` is true.", "instruction": "Concise instruction to let users know roughly on how to use this service: operations described, etc. leave empty if \`totally\` is true." }`,
    },
    {
      name: 'summarizeCallgent',
      prompt: `Given below API service{{ if (!it.totally) { }} changes: some added/removed functional entries{{ } }}:
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
};
Please re-summarize just for service \`summary\` and \`instruction\`, for user to quickly know when and how to use this service based only on these 2 fields,
output a single-lined JSON object:
{ "totally": "boolean,{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service entries to re-summarize, else left empty.{{ } }}", "summary": "Concise summary to let users quickly understand business background, the core concepts and in what scenarios to use this service(don't mention service name since it may change). leave empty if \`totally\` is true. 3k chars most", "instruction": "Concise instruction to let users know roughly on how to use this service: concepts/operations etc. leave empty if \`totally\` is true. 3k chars most" }`,
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
      id: -1,
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
