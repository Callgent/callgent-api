import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { RequestFile } from '../entries/adaptors/dto/request-requirement.dto';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EventListenersService } from '../event-listeners/event-listeners.service';
import { FilesService } from '../files/files.service';
import { Utils } from '../infras/libs/utils';
import { LLMMessage, LLMService } from './llm.service';

/** agent to generate macro script for task */
@Injectable()
export class ScriptAgentService {
  constructor(
    private readonly llmService: LLMService,
    private readonly eventListenersService: EventListenersService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly filesService: FilesService,
  ) {}
  private readonly logger = new Logger(ScriptAgentService.name);

  /**
   * map req to an API endpoint
   * - if epName means invoke: map to exact endpoint, load/gen mapArgs(req), no question
   * - if no epName request: generate exec macro function, may question
   */
  async map2Endpoints(
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }> {
    const endpoints: EndpointDto[] = reqEvent.context.endpoints;
    if (!endpoints?.length)
      throw new NotFoundException(
        'No endpoints for mapping, ClientRequestEvent#' + reqEvent.id,
      );

    // if epName, try find mapArgs function by [cepAdaptor, epName]
    const mapped = await (reqEvent.context.epName
      ? this._map2Endpoint(reqEvent, endpoints)
      : this._map2Endpoints(reqEvent, endpoints));
    reqEvent.context.map2Endpoints = mapped || {};
  }

  /**
   * generated:
   * - req2Args: reusable function generated, which is persisted in db
   * - requestArgs: actual args to invoke endpoint
   */
  @Transactional()
  protected async _map2Endpoint(
    reqEvent: ClientRequestEvent,
    endpoints: EndpointDto[],
  ) {
    const {
      id,
      srcId,
      dataType: cenAdaptor,
      context: { callgentName, epName, req, tgtEvents },
    } = reqEvent;
    const endpoint: EndpointDto = endpoints.find((e) => e.name == epName);
    if (!endpoint)
      throw new NotFoundException('map2Endpoint not found of name:' + epName);

    if (!endpoint.params || Object.keys(endpoint.params).length == 0)
      return { requestArgs: {} }; // no params

    // load existing (srcId, epName)
    const prisma = this.txHost.tx as PrismaClient;
    const cepId_sepId = { cepId: srcId, sepId: endpoint.id };
    const rec = await prisma.req2ArgsRepo.findUnique({
      select: { req2Args: true },
      where: { cepId_sepId },
    });
    if (rec) {
      try {
        const fun = Utils.toFunction(rec.req2Args);
        const requestArgs = fun(req);
        return { requestArgs };
      } catch (e) {
        this.logger.warn(
          'Error mapping request to args, ignore and regenerate',
          e,
        );
      }
    }

    // generate
    const mapped = (await this.llmService.query(
      'map2Endpoint',
      { req, epName, callgentName, cepAdaptor: cenAdaptor, endpoints },
      {
        parseSchema: { req2Args: '' },
        bizKey: id,
        validate: (data) => {
          try {
            const fun = Utils.toFunction(data.req2Args);
            (data as any).requestArgs = fun(req);
          } catch (e) {
            throw new Error(
              '[map2Endpoint] Wrong generation `req2Args` function: ' +
                e.message,
            );
          }
          return true;
        },
      },
    )) as { req2Args: string; requestArgs: object };

    if (mapped?.req2Args)
      await prisma.req2ArgsRepo.upsert({
        where: { cepId_sepId },
        update: { req2Args: mapped.req2Args },
        create: { ...cepId_sepId, req2Args: mapped.req2Args },
      });

    return { requestArgs: mapped.requestArgs };
  }

  /**
   * choose eps, if epName, directly return
   * @returns { purposes: 'purpose of each endpoint', argsHints: 'hints on args sources' }
   */
  async _map2Endpoints(reqEvent: ClientRequestEvent, endpoints: EndpointDto[]) {
    if (reqEvent.context.epName) return; // needn't choose

    if (!endpoints?.length)
      throw new NotFoundException(
        'No endpoints for mapping, ClientRequestEvent#' + reqEvent.id,
      );

    // map from all taskId events
    const files: RequestFile[] = [];
    const messages: LLMMessage[] = [
      ...(reqEvent.histories || []),
      reqEvent,
    ].reduce((pre: LLMMessage[], h) => {
      if (h.statusCode < 0) return pre; // ignore error qas
      pre.push({
        role: 'user',
        content: JSON.stringify(h.context.req),
      });
      // @see RequestRequirement.files, todo remove duplications
      h.context.req.files?.length && files.push(...h.context.req.files);

      // ignore processing/pending
      if (![1, 2].includes(h.statusCode)) {
        const resp = h.context.resp
          ? h.context.resp
          : { statusCode: h.statusCode, message: h.message };
        pre.push({
          role: 'assistant',
          content: JSON.stringify(resp),
        });
      }
      return pre;
    }, []);

    const {
      id,
      srcId,
      dataType: cenAdaptor,
      context: { callgent, progressive },
    } = reqEvent;

    const { chosenEndpoints, purposes } = await this.chooseEndpoints(
      messages,
      endpoints,
      files,
      callgent,
      id,
    );

    // args confirmation //////////////////////
    messages.pop(); // remove last assistant message
    const argsHints = await this.confirmEndpointArgs(
      messages,
      chosenEndpoints,
      purposes,
      callgent,
      files,
      id,
    );

    // resources edge cases analysis //////////////////////

    // generate script //////////////////////
    messages.pop(); // remove last assistant message
    const scripts = await this._generateTaskScript(
      messages,
      chosenEndpoints,
      purposes,
      argsHints,
      callgent,
      files,
      id,
    );

    // write to files, install deps
    const cwd = reqEvent.getTaskCwd(this.filesService.UPLOAD_BASE_DIR);
    await this.installScriptFiles(cwd, scripts, purposes, argsHints);
  }

  protected async chooseEndpoints(
    messages: LLMMessage[],
    endpoints: EndpointDto[],
    files: RequestFile[],
    callgent,
    id: string,
  ) {
    // choose eps //////////////////////
    const purposes0 = await this._chooseEndpoints(
      messages,
      endpoints,
      callgent,
      files,
      id,
    );
    // re-choose eps
    messages.pop(); // remove last assistant message
    const purposes1 = await this._reChooseEndpoints(
      messages,
      endpoints.filter((ep) => !purposes0.find((ep0) => ep0.epName == ep.name)),
      purposes0,
      callgent,
      files,
      id,
    );

    // confirm eps //////////////////////
    const epsMap: { [key: string]: EndpointDto } = {};
    const purposesSet: {
      [key: string]: {
        purposeKey: string;
        usedFor: string;
        needExternalAPI: boolean;
        candidateEndpoints: { epName: string; description: string }[];
      };
    } = {};
    purposes1.concat(purposes0).forEach((p) => {
      const { candidateEndpoints: eps } =
        purposesSet[p.purposeKey] ||
        (purposesSet[p.purposeKey] = {
          purposeKey: p.purposeKey,
          usedFor: p.usedFor,
          needExternalAPI: p.needExternalAPI,
          candidateEndpoints: [],
        });
      if (p.epName) {
        eps.push({ epName: p.epName, description: p.description });
        epsMap[p.epName] = endpoints.find((ep) => ep.name == p.epName);
      }
    });
    messages.pop(); // remove last assistant message
    const { usedEndpoints: purposes } = await this._confirmEndpoints(
      messages,
      Object.values(epsMap),
      Object.values(purposesSet),
      callgent,
      files,
      id,
    );

    Object.keys(epsMap).forEach((epName) => {
      if (!purposes.find((p) => p.epName == epName)) delete epsMap[epName];
    });
    return { chosenEndpoints: Object.values(epsMap), purposes };
  }

  protected async _chooseEndpoints(
    messages: LLMMessage[],
    endpoints: EndpointDto[],
    callgent: any,
    files: RequestFile[],
    id: string,
  ): Promise<
    {
      purposeKey: string;
      usedFor: string;
      needExternalAPI?: boolean;
      epName?: string;
      description?: string;
    }[]
  > {
    const { usedEndpoints, unaddressedAPI } = await this.llmService.chat(
      'chooseEndpoints',
      messages,
      {
        callgent,
        endpoints,
        files,
      },
      {
        bizKey: id,
        parseSchema: {
          unaddressedAPI: [
            { purposeKey: '', usedFor: '', needExternalAPI: false },
          ],
          usedEndpoints: [
            {
              purposeKey: '',
              epName: '',
              description: '',
              usedFor: '',
              needExternalAPI: false,
            },
          ],
        },
        // validate endpoints exist
        validate: (gen) =>
          (gen.usedEndpoints.length || gen.unaddressedAPI.length) &&
          gen.usedEndpoints.every((ep0) => {
            if (!ep0.epName || endpoints.find((ep) => ep.name == ep0.epName))
              return true;
            throw new Error('There is no such endpoint named: ' + ep0.epName);
          }),
      },
    );

    const purposes = Utils.uniqueBy(
      (unaddressedAPI || []).concat(usedEndpoints || []),
      'purposeKey',
    );
    return purposes;
  }

  protected async _reChooseEndpoints(
    messages: LLMMessage[],
    endpoints: EndpointDto[],
    purposes: {
      purposeKey: string;
      usedFor: string;
      needExternalAPI?: boolean;
    }[],
    callgent: any,
    files: RequestFile[],
    id: string,
  ): Promise<
    {
      purposeKey: string;
      usedFor: string;
      epName?: string;
      description?: string;
      needExternalAPI?: boolean;
    }[]
  > {
    const { usedEndpoints, unaddressedAPI } = await this.llmService.chat(
      'reChooseEndpoints',
      messages,
      {
        callgent,
        endpoints,
        purposes: purposes.map((ep) => ({
          usedFor: ep.usedFor,
          purposeKey: ep.purposeKey,
          needExternalAPI:
            'boolean: please specify if really an external openAPI is needed, **false** if local code can handle it',
        })),
        files,
      },
      {
        bizKey: id,
        parseSchema: {
          unaddressedAPI: [
            { purposeKey: '', usedFor: '', needExternalAPI: false },
          ],
          usedEndpoints: [
            {
              purposeKey: '',
              epName: '',
              description: '',
              usedFor: '',
              needExternalAPI: false,
            },
          ],
        },
        // validate endpoints exist
        validate: (gen) =>
          (gen.usedEndpoints.length || gen.unaddressedAPI.length) &&
          gen.usedEndpoints.every((ep0) => {
            if (!ep0.epName || endpoints.find((ep) => ep.name == ep0.epName))
              return true;
            throw new Error('There is no such endpoint named: ' + ep0.epName);
          }),
      },
    );

    const purposes1 = Utils.uniqueBy(
      (unaddressedAPI || []).concat(usedEndpoints || []),
      'purposeKey',
    );
    return purposes1;
  }

  protected async _confirmEndpoints(
    messages: LLMMessage[],
    endpoints: EndpointDto[],
    purposes: {
      purposeKey: string;
      usedFor: string;
      needExternalAPI: boolean;
      candidateEndpoints: {
        epName: string;
        description: string;
      }[];
    }[],
    callgent: any,
    files: RequestFile[],
    id: string,
  ) {
    const grouped = [
      purposes.slice(0, 0),
      purposes.slice(0, 0),
      purposes.slice(0, 0),
    ];
    purposes.forEach((ep) => grouped[ep.candidateEndpoints.length].push(ep));

    // Mission Impossible
    const unaddressedAPI = grouped[0].filter((ep) => ep.needExternalAPI);
    if (unaddressedAPI.length) {
      // TODO confirm unaddressed purposes

      throw new BadRequestException(
        'Mission Impossible: current service APIs is not sufficient to fulfill your request.\nUnaddressed APIs:\n' +
          unaddressedAPI
            .map((ep) => `- ${ep.purposeKey}: ${ep.usedFor}`)
            .join('\n'),
      );
    }
    // get rid of purposes that needn't external API

    const confirmedEndpoints = grouped[1].map((ep) => ({
      purposeKey: ep.purposeKey,
      usedFor: ep.usedFor,
      ...ep.candidateEndpoints[0],
    }));

    // need to opt one endpoint
    let usedEndpoints: {
      purposeKey: string;
      epName: string;
      description: string;
      usedFor: string;
    }[];
    if (grouped[2].length) {
      usedEndpoints = await this.llmService.chat(
        'confirmEndpoints',
        messages,
        {
          callgent,
          endpoints,
          purposes: { confirmedEndpoints, optEndpoints: grouped[2] },
          files,
        },
        {
          bizKey: id,
          parseSchema: [
            { purposeKey: '', epName: '', description: '', usedFor: '' },
          ],
          // validate endpoints exist
          validate: (gen) =>
            gen.length &&
            gen.every((ep0) => {
              if (!ep0.epName || endpoints.find((ep) => ep.name == ep0.epName))
                return true;
              throw new Error('There is no such endpoint named: ' + ep0.epName);
            }),
        },
      );
    } else usedEndpoints = confirmedEndpoints;

    // all endpoints are confirmed
    return { usedEndpoints };
  }

  /**
   * - ask if missing or confirm if ambiguous
   * - re-choose if need additional conversions
   * @returns args hints if all args are confirmed
   */
  protected async confirmEndpointArgs(
    messages: LLMMessage[],
    endpoints: EndpointDto[],
    purposes: {
      purposeKey: string;
      usedFor: string;
      epName: string;
      description: string;
    }[],
    callgent: any,
    files: RequestFile[],
    id: string,
  ) {
    // validate endpoints/args exist, arg has at least one source
    const parseSchema = [
      {
        purposeKey: '',
        args: [
          {
            argName: '',
            'retrieved-from-API-calls': [''],
            'extracted-from-user-info-or-files': {
              flag: false,
              userProvided: '',
              needConfirm: '',
            },
            mapping: {
              from: '',
              to: '',
              optional: false,
              mismatch: false,
              conversion: {
                steps: [],
                missing: false,
              },
            },
          },
        ],
      },
    ];
    const self = this;
    function validate(gen: typeof parseSchema) {
      return gen.every(({ purposeKey, args }) => {
        const purpose = purposes.find((p) => p.purposeKey == purposeKey);
        if (!purpose)
          throw new Error('There is no such purposeKey: ' + purposeKey);
        const ep = endpoints.find((e) => e.name == purpose.epName);

        // {[name]: schema, requestBody: schema }
        const params = {};
        const { parameters, requestBody } = (ep.params || {}) as any;
        parameters.forEach((p) => (params[p.name] = p.schema));

        const mediaTypes = requestBody
          ? Object.values(requestBody?.content)
          : [];
        params['requestBody'] =
          (mediaTypes.length && (mediaTypes[0] as any).schema) || {};

        return args.every(
          ({
            argName,
            mapping,
            'extracted-from-user-info-or-files': fromUser,
            'retrieved-from-API-calls': fromAPI,
          }) => {
            if (argName.startsWith('parameters'))
              argName = argName.replace('parameters.', '');
            const props = argName.split('.');
            if (!self._hasOpenAPIProperty(params[props.shift()], props))
              throw new Error(
                `There is no such parameter '${argName}' on endpoint '${ep.name}'`,
              );
            // at least one source
            if (
              !fromUser?.flag &&
              !fromUser.needConfirm &&
              !fromAPI?.length &&
              !mapping?.optional
            )
              throw new Error(
                `There must be at least one source for argument '${argName}' on endpoint '${ep.name}'`,
              );
            return true;
          },
        );
      });
    }
    const argsHints = await this.llmService.chat(
      'confirmEndpointsArgs',
      messages,
      {
        callgent,
        endpoints,
        purposes,
        files,
      },
      {
        bizKey: id,
        parseSchema,
        validate,
      },
    );

    // re-confirm
    const reConfirms = {};
    argsHints.forEach(({ purposeKey, args }) => {
      args.forEach((arg) => {
        const {
          argName,
          'extracted-from-user-info-or-files': fromUser,
          mapping,
        } = arg;
        if ((fromUser?.flag && fromUser.needConfirm) || mapping.mismatch) {
          const { args } =
            reConfirms[purposeKey] ||
            (reConfirms[purposeKey] = { purposeKey, args: [] });
          args.push({
            argName,
            mapping: {
              mismatch:
                'boolean: whether extracted data mismatches parameter type or constraints',
              conversion: {
                missing:
                  'boolean: carefully check step by step if conversion table or API is missing, which causes execution failure',
              },
            },
            'extracted-from-user-info-or-files': {
              flag: 'boolean: whether need user provides arg info',
            },
          });
        }
      });
    });
    const reConfirmArgs = Object.values(reConfirms);
    if (reConfirmArgs.length) {
      messages.pop(); // remove last assistant message
      const argsHints1 = await this.llmService.chat(
        'reConfirmEndpointsArgs',
        messages,
        {
          callgent,
          endpoints,
          purposes,
          reConfirmArgs,
          files,
        },
        {
          bizKey: id,
          parseSchema,
          validate: (gen) =>
            // all reConfirmArgs exist
            reConfirmArgs.every(({ purposeKey, args }) => {
              const p = gen.find((g) => g.purposeKey == purposeKey);
              if (!p)
                throw new Error(
                  'You should not miss the uncertain purposeKey: ' + purposeKey,
                );
              return args.every(({ argName }) => {
                if (p.args.find((a) => a.argName == argName)) return true;
                throw new Error(
                  `You should not miss the uncertain arg: '${argName}' on purposeKey '${purposeKey}'`,
                );
              });
            }) && validate(gen),
        },
      );
      // trust argsHints1
      argsHints1.forEach(({ purposeKey, args }) => {
        const p = argsHints.find((a) => a.purposeKey == purposeKey);
        args.forEach((arg) => {
          const idx = p.args.findIndex((a) => a.argName == arg.argName);
          if (idx >= 0) p.args[idx] = arg;
        });
      });
    }

    // clear redundant props
    const needConfirms: {
      [key: string]: {
        purposeKey: string;
        args: { argName: string; needConfirm: string }[];
      };
    } = {};
    const mismatches: { [key: string]: { purposeKey; args: any[] } } = {};
    argsHints.forEach(({ purposeKey, args }) => {
      args.forEach((arg) => {
        const {
          'extracted-from-user-info-or-files': fromUser,
          'retrieved-from-API-calls': fromAPI,
          argName,
          mapping,
        } = arg;
        if (fromUser?.flag) {
          if (fromUser.needConfirm) {
            const { args } =
              needConfirms[purposeKey] ||
              (needConfirms[purposeKey] = { purposeKey, args: [] });
            args.push({ argName, needConfirm: fromUser.needConfirm });
          } else
            arg['extracted-from-user-info-or-files'] =
              fromUser.userProvided as any;
        } else delete arg['extracted-from-user-info-or-files'];
        if (!fromAPI?.length) delete arg['retrieved-from-API-calls'];
        if (mapping) {
          delete arg.mapping.mismatch;
          if (!fromUser.needConfirm && mapping.conversion?.missing) {
            const { args } =
              mismatches[purposeKey] ||
              (mismatches[purposeKey] = { purposeKey, args: [] });
            args.push(arg);
          } else delete arg.mapping.conversion;
        }
      });
    });

    // if missing conversions, re-choose eps or mission impossible
    const missingConversion = Object.values(mismatches);
    if (missingConversion.length) {
      throw new Error('FIXME: re-choose eps or mission impossible');
    }

    // ask user if needConfirm
    const needConfirm = Object.values(needConfirms);
    if (needConfirm.length)
      throw new BadRequestException(
        'Need some clarification to fulfill the request:\n' +
          needConfirm
            .map(({ purposeKey, args }) =>
              args
                .map((a) => `- [${purposeKey}] ${a.argName}: ${a.needConfirm}`)
                .join('\n'),
            )
            .join('\n'),
      );

    return argsHints;
  }

  protected async _generateTaskScript(
    messages: LLMMessage[],
    endpoints: EndpointDto[],
    purposes: {
      purposeKey: string;
      usedFor: string;
      epName: string;
      description: string;
    }[],
    argsHints: { purposeKey: string; args: { argName: string }[] }[],
    callgent: any,
    files: RequestFile[],
    id: string,
  ) {
    // todo: generateTaskScript-{taskType}

    const [estimatedTime] = await this.llmService.chat(
      'generateTaskScript',
      messages,
      {
        callgent,
        endpoints,
        argsHints,
        purposes,
        files,
      },
      {
        bizKey: id,
        parseType: 'codeBlock',
        parseSchema: new Array(3),
        // validate index.ts and package.json
        validate: ([_, indexTs, packageJson]) =>
          packageJson && JSON.parse(packageJson)?.name,
      },
    );

    // refactor code
    messages.push({
      role: 'user',
      content: `- Review and fix bugs
- simplify \`resumingStates\`
- Double check batch processing
- null check on params/responses
- early return on any errors. since we'll retry execution if any errors, after fixing bugs based on the error message
- avoid over design.

Output clean, bug-free and robust code, and package.json`,
    });
    const [mainTs, packageJson] = await this.llmService.chat(
      'generateTaskScript',
      messages,
      {
        callgent,
        endpoints,
        argsHints,
        purposes,
        files,
      },
      {
        bizKey: id,
        parseType: 'codeBlock',
        parseSchema: Array(2),
        // validate index.ts and package.json
        validate: ([mainTs, packageJson]) =>
          packageJson && JSON.parse(packageJson)?.name,
      },
    );

    return { estimatedTime, mainTs, packageJson };
  }

  /** write script files, and install packages */
  public async installScriptFiles(
    cwd: string,
    {
      mainTs,
      packageJson,
    }: {
      mainTs: string;
      packageJson: string;
    },
    purposes: any[],
    argsHints: any[],
  ) {
    // generated files
    const p = JSON.parse(packageJson);
    p.devDependencies || (p.devDependencies = {});
    // todo: as config
    if (p.dependencies?.tsx) delete p.dependencies.tsx;
    if (p.dependencies?.typescript) delete p.dependencies.typescript;
    p.devDependencies.tsx = '^4.19.2';
    p.devDependencies.typescript = '^5.7.3';
    this.filesService.save(
      {
        'main.ts': mainTs,
        'package.json': JSON.stringify(p),
        'purposes.json': JSON.stringify(purposes),
        'args-hints.json': JSON.stringify(argsHints),
      },
      cwd,
    );

    // template files
    this.filesService.copy(
      [
        {
          originalname: 'index.ts',
          mimetype: 'application/typescript',
          path: './templates/task-runner/index.ts',
          fieldname: '',
          encoding: 'utf8',
        },
        {
          originalname: 'pipe-client.ts',
          mimetype: 'application/typescript',
          path: './templates/task-runner/pipe-client.ts',
          fieldname: '',
          encoding: 'utf8',
        },
        {
          originalname: 'pnpm-lock.yaml',
          mimetype: 'text/yaml',
          path: './templates/task-runner/pnpm-lock.yaml',
          fieldname: '',
          encoding: 'utf8',
        },
        {
          originalname: 'tsconfig.json',
          mimetype: 'application/json',
          path: './templates/task-runner/tsconfig.json',
          fieldname: '',
          encoding: 'utf8',
        },
      ],
      cwd,
    );

    // install packages
    try {
      execSync('pnpm install', {
        cwd,
        encoding: 'utf8',
      });
    } catch (err) {
      const { stderr } = err;
      const e = stderr
        ?.toString()
        .split('\n')
        .filter((l) => l.indexOf('bugger') < 0)
        .join('\n');
      if (!e) return;
      throw err;
    }
  }

  public async fixScriptError(message: string, reqEvent: ClientRequestEvent) {
    // throw new Error('Method not implemented.');
    return false;
  }

  /**
   * @param schema - OpenAPI schema object
   * @param props - array of chained property names to check for
   */
  private _hasOpenAPIProperty(schema, props: string[]) {
    if (!schema || typeof schema !== 'object') return false;
    if (!props?.length) return true;

    // Handle OpenAPI combination keywords
    if (schema.anyOf) {
      return schema.anyOf.some((subSchema: any) =>
        this._hasOpenAPIProperty(subSchema, props),
      );
    }
    if (schema.oneOf) {
      return schema.oneOf.some((subSchema: any) =>
        this._hasOpenAPIProperty(subSchema, props),
      );
    }
    if (schema.allOf) {
      return schema.allOf.every((subSchema: any) =>
        this._hasOpenAPIProperty(subSchema, props),
      );
    }

    switch (schema.type) {
      case 'array':
        return this._hasOpenAPIProperty(schema.items, props);
      case 'object':
        schema = schema.properties;
        if (!schema) return false;
    }
    return this._hasOpenAPIProperty(schema[props.shift()], props);
  }
}
