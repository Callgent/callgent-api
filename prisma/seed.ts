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
{ "totally": "{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service endpoints to re-summarize, else left empty.{{ } }}",   "summary": "Concise summary to let users quickly understand in what scenarios to use this service. leave empty if \`totally\` is true.", "instruction": "Concise instruction to let users know roughly on how to use this service: concepts/operations etc. leave empty if \`totally\` is true." }`,
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
{ "totally": "{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service entries to re-summarize, else left empty.{{ } }}", "summary": "Concise summary to let users quickly understand in what scenarios to use this service(don't mention service name since it may change). leave empty if \`totally\` is true. 3k chars most", "instruction": "Concise instruction to let users know roughly on how to use this service: concepts/operations etc. leave empty if \`totally\` is true. 3k chars most" }`,
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

Now let's goto #1, as world-class frontend expert, please design necessary simple view pages, output a single-lined json object:
{ "views": {[FormalViewName: string]: {"url": "route url", "file": "/src/views/{file-name}.vue", "title":"view title", "summary":"brief summary of use cases", "instruction": "Description of interactive prototype(layout, elements, operations, dynamic effects, etc) to guide developer to implement", "distance":"integer to indicate distance of the view to root view, 0 means root"}}, "/src/router/index.js": "full implementation code, no process.env.*!" }`,
    },
    // TODO component tree
    {
      name: 'genVue2Components',
      prompt: `For Vue3+Pinia app with views:
[
  {"name":"{{=it.view.name}}","url":"{{=it.view.url}}","file":"{{=it.view.file}}","title":"{{=it.view.title}}","summary":"{{=it.view.summary}}","instruction":"{{=it.view.instruction}}},{{~it.otherViews:ov}}
  {"name":"{{=ov.name}}","url":"{{=ov.url}}","title":"{{=ov.title}}","summary":"{{=ov.summary}}"},{{~}}
],
and existing UI components:
{{=JSON.stringify(it.components)}},

Depending on the packages stack: [{{=it.packages}}], use these components for best practice,
As world-class frontend architect, please design simple components(not embedded into each other, each with single responsibility and minimal props) for entire view \`{{=it.view.name}}\`, which are back-ended by service endpoints: [{{~ it.endpoints :ep }}
  { "id": "{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params": {{=JSON.stringify(ep.params)}} },{{~}}
],
Note: all API params are already documented here! Components access them only via store states/actions.

Please refine existing or add new components for view \`{{=it.view.name}}\`, output a single-lined json object:
{ [FormalComponentName: string]: {"file": "/src/components/{file-name}.vue", "endpoints":["endpoint ids(METHOD /resource/url), which **may** be used by the component", "may empty array" ..], "summary":"precise summary to let developers correctly use the component without reading the code!", "instruction": "Description of interactive prototype(layout, elements, operations, dynamic effects, etc) to guide developer to implement. ignore auth logic, which is handled outside of the VUE app" }}
After design before output, please redesign to meet rules:
- Assigning single responsibilities to each component
- Not missing any components or service endpoints for the \`{{=it.view.name}}\` view functionalities, yet make the view as simple as possible
- Not including functionalities from other views, we'll design them later
- component props are prohibited, all state goes into pinia stores
- It's OK to cut functionalities to make components only uses API params listed above!
- if \`endpoints\` empty, please describe brief store actions logic in \`instruction\`
- describe interactive dynamics between components in \`instruction\``,
    },
    {
      name: 'genVue3Apis',
      prompt: `Given proposed UI components of a Vue3+Pinia app: [{{~ it.compsList :comp }}
  { "name": "{{=comp.name}}", "props": {{=JSON.stringify(comp.props)}}, "summary":"{{=comp.summary}}", "instruction": "{{=comp.instruction}}" },{{~}}
],

Back-ended with the following service APIs:
Service \`{{=it.callgent.name}}\` { "summary": "{{=it.callgent.summary}}", "instruction": "{{=it.callgent.instruction}}", "endpoints": [{{~ it.endpoints :ep }}
  { "id": "{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"parameters": {{=JSON.stringify(ep.params)}} },{{~}}
  ]
},

As world-class frontend expert, please adjust/remove components to fit APIs params, even if it means reducing the required functionality!
Note: all API params are totally listed above!
output a single-lined json object:
{[ComponentName: string]: {"endpoints":["endpoint ids(METHOD /resource/url), which \`may\` be used by the component", ..], "removed": "mark current component as removed if APIs can't fulfill the functionality, then set component's other attributes to empty.", "props": ["similar to function params. please use store state as possible", "must remove unsupported props, may empty", ..], "summary":"Adjusted summary", "instruction": "Adjusted instruction"} }`,
    },
    {
      name: 'genVue4Component',
      prompt: `For Vue3+Pinia app with components structure:
{
  "components": {{=JSON.stringify(it.components)}},
  "relatedViews": {{=JSON.stringify(it.relatedViews)}},
  "otherViews": {{=JSON.stringify(it.otherViews)}},
  "stores": {{=JSON.stringify(it.stores)}},
  "packages": {{=JSON.stringify(it.packages)}}
};

As world-class frontend expert, please write \`{{=it.components[0].file}}\` full code based on it's instruction and endpoint APIs(especially props).
the component must import relevant \`stores/*.js\` for Pinia models and actions, needn't generate stores code in current step.
output a single-lined json object:
{ "packages":["additional real packages(format: package@version) imported by current file, don't list existing/different versioned/unused ones!","make sure packages exists!","may empty array"], "importedStores": [{"file": "/src/stores/{file-name}.js", "state": {"State JSON object used by current component, list detailed props used by component for each entity(give example object each arrays). don't list props not used by current component. better use existing, add new if needed"}, "actions": ["Actions(full params/resp signature) used by current component, especially wrap APIs into actions. better use existing, add new if needed.", "don't list actions not used by current component", ..], "getters": ["getters used by current component. add new if needed", "don't list getters not used by current component", ..]}, ..], "code": "formatted lines of full(don't ignore any code, since we put the code directly into project without modification) implementation code for \`/src/components/JobListTable.vue\`. pay special attentions to interaction states/error handling/validations; Only access endpoint APIs through store actions. Be very careful don't introduce bugs, it causes money loss for us!", "spec": {"props":["prop name","may empty array, no empty string"],"slots":[{"name":"","summary":""}],"events":[{"name":"","summary":"","payload":{[example of payload]}}],"components":["dependent ComponentNames defined by this project","don't list 3rd-party components","may empty array, no empty string"]} }`,
    },
    {
      name: 'genVue5Store',
      prompt: `For Vue3+Pinia app, please generate \`{{=it.store.file}}\` following the specification:
{{=JSON.stringify(it.store)}};

existing packages: {{=JSON.stringify(it.packages)}};
NOTE: call all API with const apiBaseUrl= '{{=it.apiBaseUrl}}';
As world-class frontend expert, please write the code, output a single-lined json object:
{ "packages":["additional packages(format: package@version) imported by current file, don't list existing/different versioned/unused ones!","make sure packages exists!","may empty array"], "code": "formatted lines of full(don't ignore any code, since we put the code directly into project without modification) implementation js(not ts) code. Be very careful don't introduce bugs, it causes money loss for us!" }.
NOTE: strictly prohibit import any stores in view, so stores are only accessed among components!`,
    },
    {
      name: 'genVue6View',
      prompt: `For Vue3+Pinia app, please generate \`{{=it.view.file}}\` following the specification:
{
  "view": {{=JSON.stringify(it.view)}},
  "otherViews": {{=JSON.stringify(it.otherViews)}}
},
Dependent components by current view page, choose the best ones for current view: {{=JSON.stringify(it.components)}};
existing packages: {{=JSON.stringify(it.packages)}};

As world-class frontend expert, please write the code, output a single-lined json object:
{ "packages":["additional packages(format: package@version) imported by current file, don't list existing/different versioned/unused ones!","make sure packages exists!","may empty array"], "code": "formatted lines of full(don't ignore any code, since we put the code directly into project without modification) implementation js code. Be very careful don't introduce bugs, it causes money loss for us!" }.
NOTE: strictly prohibit importing any stores in this view!`,
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
