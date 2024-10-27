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
      srcId: 'GLOBAL',
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
      id: 'CR-CEP-AUTH',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'CallgentRealmsService',
      funName: 'checkCepAuth',
      description:
        'Auth-check before cep invocation. current security: reqEvent.context.security: RealmSecurityVO[]',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-LOAD-TARGET',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EventStoresService',
      funName: 'loadTargetEvents',
      description:
        'Load all events of same taskId into event.context.tgtEvents',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-LOAD-ENDPOINTS',
      srcId: 'GLOBAL',
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
      srcId: 'GLOBAL',
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
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'AgentsService',
      funName: 'map2Endpoints',
      description:
        'Map the request to endpoints and corresponding args, put into event.context.map2Endpoints and event.context.endpoints[0]',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-SEP-AUTH',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'CallgentRealmsService',
      funName: 'checkSepAuth',
      description:
        'Auth-check before sep invocation. current security: reqEvent.context.security: RealmSecurityVO[]',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      id: 'CR-INVOKE-SEP',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EntriesService',
      funName: 'invokeSEP',
      description: 'Do actual invocation through the SEP adaptor',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    // {
    //   pk: elId++,
    //   id: 'PR-MAP-2-ARGS',
    //   srcId: 'GLOBAL',
    //   tenantPk: 0,
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
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params":{{=JSON.stringify(ep.params)}}, "responses":{{=JSON.stringify(ep.responses)}} },
{{~}}}

Please generate js function req2Args(request) to map below request into endpoint args following the openAPI params schema:
const request_object = {{=JSON.stringify(it.req)}};

output single-line json object below:
{ "req2Args": "Full code of js function req2Args(request_object):ArgsMap, to map request into endpoint args. ArgsMap is a k-v map of vars in endpoint.params(no conflict keys, no more props than it, especially requestBody's key is '$requestBody$'), all values just extracted from request_object, but no direct constant in code from request_object, all calculated from request_object props as variables!" }`,
    },
    {
      name: 'map2Endpoints',
      prompt: `given below service endpoints:
service \`{{=it.callgentName}}\` { {{~ it.endpoints :ep }}
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params":{{=JSON.stringify(ep.params)}}, "responses":{{=JSON.stringify(ep.responses)}} },
{{~}}}

Please choose relevant endpoints to fulfill below request:
const request = {
{{ if (it.epName) { }}"requesting endpoint": "{{=it.epName}}",
{{ } }}"request from": "{{=it.cepAdaptor}}",
"request_object": {{=JSON.stringify(it.req)}},
},
using the js macro function:
\`\`\`typescript
async function macro(macroParams) {
  const ctx = {}; // context vars across endpoint invocations to final response
  // logic script which uses \`callServerEndpoint(epId, epParams)\` to get final result
  // NOTE: macroParams/epParams are k-v map of needed vars, especially requestBody's key is '$requestBody$'
  const result = await invokeEndpoints(macroParams, ctx)
  // wrap result into response
  const resp = wrapResp(ctx, macroParams, result);
  return resp;
}
// implementation of: invokeEndpoints/wrapResp
\`\`\`

output single-line json object below:
{ "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. '' if the args mapping is crystal clear. if question not empty, all subsequent props(endpoints, macroParams,..) left empty", "endpoints": ["the chosen API endpoints to be invoked"], "summary":"short summary", "description":"Description help using this macro", "macroParams":"object of formal openAPI format json: {parameters?:[], requestBody?:{"content":{[mediaType]:..}}}, macro incoming params", "macroResponse": "object of formal openAPI format json {[http-code]:any}, final macro response", "args": "k-v map of needed args in \`macro-params\`(no conflict keys, no more props than it, '$requestBody$' is key for requestBody arg), all values just extracted from request.request_object, this is the actual args value to call \`const resp=await macro(args)\`", "invokeEndpoints": "full code of async js function(macroParams:MacroParams, ctx). no direct constant extracted from request.request_object", "wrapResp": "full code of js function(ctx, macroParams, result) to get resp matching \`macroResponse\` schema. No direct constant extracted from request.request_object" }`,
    },
    {
      name: 'convert2Response',
      prompt: `Given the openAPI endpoint:
{"endpoint": "{{=it.ep.name}}", "summary":"{{=it.ep.summary}}", {{=it.ep.description ? '"description":"'+it.ep.description+'", ':''}}"params":{{=JSON.stringify(it.ep.params)}}, "responses":{{=JSON.stringify(it.ep.responses)}} }

invoked with the following request:
<--- request begin ---
{{=JSON.stringify(it.args)}}
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
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params":{{=JSON.stringify(ep.params)}}, "responses":{{=JSON.stringify(ep.responses)}} },{{~}}
{{ } else { }}
  summary: '{{=it.entry.summary}}',
  instruction: '{{=it.entry.instruction}}',
  endpoints: { {{ if (it.news && it.news.length) { }}
    existing: {...},
    added: { {{~ it.news : ep }}
      "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params":{{=JSON.stringify(ep.params)}}, "responses":{{=JSON.stringify(ep.responses)}} },{{~}}
    },{{ } }}{{ if (it.olds && it.olds.length) { }}
    removed: { {{~ it.olds : ep }}
      "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params":{{=JSON.stringify(ep.params)}}, "responses":{{=JSON.stringify(ep.responses)}} },{{~}}
    },{{ } }}
  }{{ } }}
};
Please re-summarize service \`summary\` and \`instruction\`, for user to quickly know when and how to use this service based only on these 2 fields,
output a single-lined JSON object:
{ "totally": "{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service endpoints to re-summarize.{{ } }}",   "summary": "Concise summary to let users quickly understand in what scenarios to use this service. leave empty if \`totally\` is true.", "instruction": "Concise instruction to let users know roughly on how to use this service: concepts/operations etc. leave empty if \`totally\` is true." }`,
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
Please re-summarize service \`summary\` and \`instruction\`, for user to quickly know when and how to use this service based only on these 2 fields,
output a single-lined JSON object:
{ "totally": "{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service entries to re-summarize.{{ } }}", "summary": "Concise summary to let users quickly understand in what scenarios to use this service(don't mention service name since it may change). leave empty if \`totally\` is true. 3k chars most", "instruction": "Concise instruction to let users know roughly on how to use this service: concepts/operations etc. leave empty if \`totally\` is true. 3k chars most" }`,
    },
    {
      name: 'genVue1Route',
      prompt: `Given requirement:
{ "description": "{{=it.requirement}}" }

You need to generate a Vue3+Pinia app for user to interact with backend service APIs:
Service \`{{=it.callgent.name}}\` { "summary": "{{=it.callgent.summary}}", "instruction": "{{=it.callgent.instruction}}", "endpoints": {...} },

There are 7 steps to generate code to fulfil the requirement:
1. generate \`/src/router/index.js\`, only necessary \`views\` for the requirement
2. define necessary Vue \`components\`, associate with each \`view\`: {view: [comps]};
3. choose needed service endpoints for each component: {comp: [apis]};
4. generate \`/src/components/*.vue\` code, which may import \`/src/stores/*.js\`;
5. generate \`/src/stores/*.js\` used by components, bind \`actions\` to service endpoints.
6. generate \`/src/views/*.vue\` code, which imports \`/src/components/*.js\`, and \`/src/stores/*.js\` if really needed.
7. generate /src/App.vue, /src/main.js

Now let's goto #1, design several view pages, please output a single-lined json object:
{ "views": {[FormalViewName: string]: {"url": "route url", "file": "/src/views/{file-name}.vue", "title":"view title", "summary":"brief summary of use cases", "instruction": "Description of interactive prototype(layout, elements, operations, dynamic effects, etc) to guide developer to implement", "distance":"integer to indicate distance of the view to root view, 0 means root"}}, "/src/router/index.js": "full implementation code. escape special chars to be valid json string" }`,
    },
    {
      name: 'genVue2Components',
      prompt: `Given requirement:
{ "description": "{{=it.requirement}}" }

You need to generate a Vue3+Pinia app for user to interact with backend service APIs:
Service \`{{=it.callgent.name}}\` { "summary": "{{=it.callgent.summary}}", "instruction": "{{=it.callgent.instruction}}", "endpoints": {...} },

There are 7 steps to generate code to fulfil the requirement:
1. generate \`/src/router/index.js\`, only necessary \`views\` for the requirement
2. define necessary Vue \`components\`, associate with each \`view\`: {view: [comps]};
3. choose needed service endpoints for each component: {comp: [apis]};
4. generate \`/src/components/*.vue\` code, which may import \`/src/stores/*.js\`;
5. generate \`/src/stores/*.js\` used by components, bind \`actions\` to service endpoints.
6. generate \`/src/views/*.vue\` code, which imports \`/src/components/*.js\`, and \`/src/stores/*.js\` if really needed.
7. generate /src/App.vue, /src/main.js

Base on the views list from #1:
{{=JSON.stringify(it.views)}}

Now let's goto #2, design several components, please output a single-lined json object:
{"components":{[FormalComponentName: string]: {"file": "/src/components/{file-name}.vue", "summary":"brief summary of use cases", "instruction": "Description of interactive prototype(layout, elements, operations, dynamic effects, etc) to guide developer to implement. ignore auth logic, which is handled outside of the VUE app."}}, "associations": { [FormalViewName: string]: ["component formal names array", "some components may be shared by multiple views", ..] }`,
    },
    {
      name: 'genVue3Apis',
      prompt: `Given proposed UI components of a Vue3+Pinia app: [{{~ it.compsList :comp }}
  { "name": "{{=comp.name}}", "summary":"{{=comp.summary}}", "instruction": "{{=comp.instruction}}" },{{~}}
],

Back-ended with the following service APIs:
Service \`{{=it.callgent.name}}\` { "summary": "{{=it.callgent.summary}}", "instruction": "{{=it.callgent.instruction}}", "endpoints": [{{~ it.endpoints :ep }}
  { "id": "{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters": {{=JSON.stringify(ep.params)}} },{{~}}
  ]
},

Please choose needed service endpoints for each component,
Note: all API params are totally listed above, yet components must be changed to fit APIs, so you can remove components if APIs don't support it, or adjust component summary/instruction to fit APIs params!
output a single-lined json object(don't list removed components):
{[ComponentName: string]: {"endpoints":["endpoint ids(METHOD /resource/url), which \`may\` be used by the component", ..], "summary":"Adjusted summary", "instruction": "Adjusted instruction"} }`,
    },
    {
      name: 'genVue4Components',
      prompt: `For Vue3+Pinia app with components structure:
{
  "components": {{=JSON.stringify(it.components)}},
  "relatedViews": {{=JSON.stringify(it.relatedViews)}},
  "otherViews": {{=JSON.stringify(it.otherViews)}},
  "stores": {{=JSON.stringify(it.stores)}}
};

Please generate \`/src/components/JobListTable.vue\` full code based on it's instruction and endpoint APIs(especially props), and utilize \`element-ui@2.15.14\` as UI library,
the component must import relevant \`stores/*.js\` for Pinia models and actions, needn't generate stores code in current step.
output a single-lined json object:
{ "importedStores": [{"file": "/src/stores/{file-name}.js", "state": {"State JSON object used by current component. don't list props not used by current component"}, "actions": ["Actions used by current component, all APIs goes here. you may extend existing, or create new ones.", "don't list items not used by current component", ..], "getters": ["getters used by current component", "don't list items not used by current component", ..]}, ..], "code": "formatted lines of full implementation code for \`/src/components/JobListTable.vue\`. pay special attentions to interaction states and error handling. Escape special chars to be valid json string" }`,
    },
  ];

  return llmTemplates.map((llmTpl) =>
    prisma.llmTemplate
      .upsert({
        where: { name: llmTpl.name },
        update: llmTpl,
        create: llmTpl,
      })
      .then((llmTpl) => console.log({ llmTpl })),
  );
}
function initTags(
  prisma: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
) {
  const tags: Prisma.TagCreateInput[] = [
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
        'Find database APIs on the Postman Public API Network. Discover public APIs to retrieve data and work with databases',
    },
    {
      name: 'Developer Productivity',
      description:
        'Must-fork APIs to improve productivity during the software development lifecycle and fasten the execution process',
    },
    {
      name: 'DevOps',
      description:
        'APIs recommended by Postman to enable quick CI/CD, build automation, containerization, config management during code deployment process',
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
      description:
        'Exciting Travel APIs handpicked by Postman for seamless retrieval of real',
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
