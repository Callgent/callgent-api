import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  return await Promise.all(initData());
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
      pk: elId++,
      id: 'CR-ADAPTOR-PREPROCESS',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EndpointsService',
      funName: 'preprocessClientRequest',
      description: 'Find the CEP, then preprocess the request',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      pk: elId++,
      id: 'CR-LOAD-FUNCTIONS',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'CallgentFunctionsService',
      funName: 'loadFunctions',
      description:
        'Load all entries of the callgent into event.context.functions',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      pk: elId++,
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
      pk: elId++,
      id: 'CR-MAP-2-FUNCTION',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'AgentsService',
      funName: 'map2Function',
      description:
        'Map the request to a endpoint function and corresponding args, put into event.context.map2Function and event.context.functions[0]',
      createdBy: 'GLOBAL',
      priority: (priority += 100),
    },
    {
      pk: elId++,
      id: 'CR-INVOKE-SEP',
      srcId: 'GLOBAL',
      tenantPk: 0,
      eventType: 'CLIENT_REQUEST',
      dataType: '*',
      serviceType: 'SERVICE',
      serviceName: 'EndpointsService',
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
        where: { pk: el.pk },
        update: el,
        create: el,
      })
      .then((el) => console.log(el)),
  );
}

async function initLlmTemplates() {
  const llmTemplates: Prisma.LlmTemplateUncheckedCreateInput[] = [
    {
      pk: 1,
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
      pk: 2,
      name: 'map2Function',
      prompt: `given below service APIs:
service {{=it.callgentName}} {{{~ it.callgentFunctions :fun }}
  "API: {{=fun.name}}": {"endpoint": "{{=fun.name}}", "summary":"{{=fun.summary}}", {{=fun.description ? '"description":"'+fun.description+'", ':''}}"params":{{=JSON.stringify(fun.params)}}, "responses":{{=JSON.stringify(fun.responses)}} },
{{~}}}

Please choose one API to fulfill below request:
{
{{ if (it.funName) { }}"requesting endpoint": "{{=it.funName}}",
{{ } }}"request from": "{{=it.cepAdaptor}}",
"request_object": {{=JSON.stringify(it.req)}},
}
and code for request_object to chosen function args mapping. if any data missing/unclear/ambiguous from request_object to invocation args, please ask question to the caller in below json.question field.

output a single-line json object:
{ "endpoint": "the chosen API endpoint to be invoked", "args":"request params/body/headers/..., with same structure as the signature JSON object(no more args than it), or null if no args needed", "mapping": "if the the request_object is structured (or null if unstructured), generate the js function (request_object)=>{...;return API_signature_args;}, full implementation to return the **real** args from request_object to invoke the API. don't use data not exist or ambiguous in request", "question": "question to ask the caller if anything not sure or missing for request to args mapping, *no* guess or assumption of the mapping. null if the mapping is crystal clear." }"}`,
    },
  ];

  return llmTemplates.map((llmTpl) =>
    prisma.llmTemplate
      .upsert({
        where: { pk: llmTpl.pk },
        update: llmTpl,
        create: llmTpl,
      })
      .then((llmTpl) => console.log({ llmTpl })),
  );
}
