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
