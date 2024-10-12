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
      id: 'CR-LOAD-TARGET',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EventStoresService',
      funName: 'loadTargetEvents',
      description:
        'Load all events of same targetId into event.context.tgtEvents',
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
      id: 'CR-GENERATE-WEBPAGE',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: 'Webpage',
      serviceType: 'SERVICE',
      serviceName: 'WebpagesService',
      funName: 'genWebpage',
      description:
        'Generate webpage[view/model/view-model] from request & endpoints',
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
    {
      name: 'api2Function',
      prompt: `Please convert below API doc of format {{=it.format}}:
{ "{{=it.apiName}}": {{=it.apiContent}} }

into a js function, the function must be as follows:
// the \`invoker\` function do the real invocation
async (invoker: {{=it.handle}}, ...apiParams) {...; const json = await invoker(...); ...; return apiResult; }

please generate the js function with **full implementation and error handling**! output a single-line json object:
{"epName":"endpoint name", "params":["invoker", ...apiParams]"documents":"formal js function documentation with description of params and response object with **all properties elaborated** exactly same as the API doc", "fullCode":"(invoker, ...)=>{...; const json = await invoker(...); ...; return apiResult;}"}`,
    },
    {
      name: 'map2Endpoints',
      prompt: `given below service APIs:
service {{=it.callgentName}} {{{~ it.endpoints :fun }}
  "API: {{=fun.name}}": {"endpoint": "{{=fun.name}}", "summary":"{{=fun.summary}}", {{=fun.description ? '"description":"'+fun.description+'", ':''}}"params":{{=JSON.stringify(fun.params)}}, "responses":{{=JSON.stringify(fun.responses)}} },
{{~}}}

Please choose one API to fulfill below request:
{
{{ if (it.epName) { }}"requesting endpoint": "{{=it.epName}}",
{{ } }}"request from": "{{=it.cepAdaptor}}",
"request_object": {{=JSON.stringify(it.req)}},
}
and code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.

output a single-line json object:
{ "endpoint": "the chosen API endpoint to be invoked", "args":"params/body/headers/..., with same structure as the 'params' JSON object(no more args than it) with additional 'value' prop, or null if no args needed", "mapping": "if the the request_object is structured (or null if unstructured), generate the js function (request_object)=>{...;return API_signature_args;}, full implementation to return the **real** args from request_object to invoke the API. don't use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}`,
    },
    {
      name: 'convert2Response',
      prompt: `Given the openAPI endpoint:
{"endpoint": "{{=it.fun.name}}", "summary":"{{=it.fun.summary}}", {{=it.fun.description ? '"description":"'+it.fun.description+'", ':''}}"params":{{=JSON.stringify(it.fun.params)}}, "responses":{{=JSON.stringify(it.fun.responses)}} }

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
