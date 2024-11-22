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
      funName: 'loadTargetEvents',
      description:
        'Load all events of same taskId into event.context.tgtEvents',
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
      serviceName: 'AgentsService',
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
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params":{{=JSON.stringify(ep.params)}}, "responses":{{=JSON.stringify(ep.responses)}} },
{{~}}}

Please generate js function req2Args(request) to map below request into endpoint args following the openAPI params schema:
const request_object = {{=JSON.stringify(it.req)}};

output single-line json object below:
{ "req2Args": "Full code of js function req2Args(request_object):ArgsMap, to map request into endpoint args. ArgsMap is a k-v map of vars in endpoint.params(no conflict keys, no more props than it), all values just extracted from request_object, but no direct constant in code from request_object, all calculated from request_object props as variables!" },
output just json no explanation`,
    },
    {
      name: 'map2Endpoints',
      prompt: `# Task goal:
generating js service class to orchestrate the given service endpoints to fulfill a user request

## user request:
const request = {
{{ if (it.epName) { }}"requesting endpoint": "{{=it.epName}}",
{{ } }}"requested from": "{{=it.cenAdaptor}}",
"request_object": {{=JSON.stringify(it.req)}},
}

## service endpoints:
service \`{{=it.callgentName}}\` {{{~ it.endpoints :ep }}
  "{{=ep.name}}": {"summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params":{{=JSON.stringify(ep.params)}}, "responses":{{=JSON.stringify(ep.responses)}} },{{~}}
}

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
    const cbMemberFun = \`some\${epName}Cb\`; // a RequestMacro member function name
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

**note:** every serviceInvoke may return statusCode 2, so we break the whole logic into member functions

## all member functions(including \`main\`) have same signature:
function(asyncResponse: any, context:{ [varName:string]:any }): Promise<{cbMemberFun,message}|{data?,statusCode?,message?}>
@param asyncResponse
- for RequestMacro.main: it means requestArgs, matching macroParams schema
- for any other member functions: received endpoint successful response object
@param context: the same context object passes through out all member invocations, keeping shared state
@returns
- {cbMemberFun,message}: tell endpoint to callback \`cbMemberFun\` later
- {data:'user request's final response, matching one of macroResponse schema',statusCode:'corresponding http-code',message?}

## generated code output json format:
{ "question": "question to ask the user, if any information not sure or missing while mapping from request to main#requestArgs, *no* guess or assumption of the mapping. set to '' if the args mapping is crystal clear. if question not empty, leave all subsequent props(endpoints, macroParams,..) empty",
  "endpoints": ["the chosen endpoint names to be invoked"], "summary":"short summary to quickly understand what RequestMacro does", "instruction":"Instruction helps using this service",
  "macroParams":"schema of main#requestArgs, a formal openAPI format json: {parameters?:[], requestBody?:{"content":{[mediaType]:..}}}", "macroResponse": "schema of final response of the user request, a formal openAPI format json {[http-code]:any}",
  "requestArgs": "k-v dto following $.macroParams schema(no additional props than $.macroParams defined! optional props can be omitted, default values can be used). all values are semantically extracted from \`request.request_object\`",
  "memberFunctions": { "main":"full js function implementation code, the code must have not any info from request.request_object, all request info just from requestArgs", [callbackFunName:string]:"full js function code. async service endpoints will callback to these functions with real response" }
}`,
    },
    {
      name: 'convert2Response',
      prompt: `Given the openAPI endpoint:
{"endpoint": "{{=it.ep.name}}", "summary":"{{=it.ep.summary}}", {{=it.ep.description ? '"description":"'+it.ep.description+'", ':''}}"params":{{=JSON.stringify(it.ep.params)}}, "responses":{{=JSON.stringify(it.ep.responses)}} }

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
Please re-summarize just for service \`summary\` and \`instruction\`, for user to quickly know when and how to use this service based only on these 2 fields,
output a single-lined JSON object:
{ "totally": "boolean,{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service endpoints to re-summarize, else left empty.{{ } }}",   "summary": "Concise summary to let users quickly understand in what scenarios to use this service. leave empty if \`totally\` is true.", "instruction": "Concise instruction to let users know roughly on how to use this service: concepts/operations etc. leave empty if \`totally\` is true." }`,
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
{ "totally": "boolean,{{ if (it.totally) { }}set to empty{{ }else{ }}set to true if you need to reload all service entries to re-summarize, else left empty.{{ } }}", "summary": "Concise summary to let users quickly understand in what scenarios to use this service(don't mention service name since it may change). leave empty if \`totally\` is true. 3k chars most", "instruction": "Concise instruction to let users know roughly on how to use this service: concepts/operations etc. leave empty if \`totally\` is true. 3k chars most" }`,
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
  { "id": "{{=ep.name}}", "summary":"{{=ep.summary}}", {{=ep.description ? '"description":"'+ep.description+'", ':''}}"params": {{=JSON.stringify(ep.params)}} },{{~}}
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
