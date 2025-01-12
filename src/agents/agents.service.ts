import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { Endpoint } from '../endpoints/entities/endpoint.entity';
import { Entry } from '../entries/entities/entry.entity';
import { ClientRequestEvent } from '../entries/events/client-request.event';
import { EventListenersService } from '../event-listeners/event-listeners.service';
import { Utils } from '../infras/libs/utils';
import { ProgressiveRequestEvent } from './events/progressive-request.event';
import { LLMMessage, LLMService } from './llm.service';

/** early validation principle[EVP]: validate generated content ASAP.
 * TODO: forward to user to validate macro signature (progressively)? program validate generated schema */
@Injectable()
export class AgentsService {
  constructor(
    private readonly llmService: LLMService,
    private readonly eventListenersService: EventListenersService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  /** convert resp content into one of fun.responses */
  async convert2Response(
    requestArgs: { [name: string]: any },
    resp: string,
    ep: EndpointDto,
    eventId: string,
  ) {
    requestArgs = requestArgs
      ? Object.entries(requestArgs).map(([name, value]) => ({ name, value }))
      : [];
    const mapped = await this.llmService.query(
      'convert2Response',
      { requestArgs, resp, ep },
      {
        parseSchema: { statusCode: 200, data: null },
        bizKey: eventId,
      },
    ); // TODO validating `mapping`

    return mapped;
  }

  /**
   * @param total - whether summarizing from all eps of entry
   * @returns
   */
  async summarizeEntry(data: {
    entry: {
      id: string;
      summary?: string;
      instruction?: string;
      callgentId?: string;
    };
    news?: Omit<Endpoint, 'securities' | 'createdAt'>[];
    olds?: Omit<Endpoint, 'securities' | 'createdAt'>[];
    totally?: boolean;
  }) {
    const result = await this.llmService.query('summarizeEntry', data, {
      parseSchema: { summary: '', instruction: '', totally: true },
      bizKey: data.entry.id,
    });
    return result;
  }

  /**
   * @param total - whether summarizing from all eps of entry
   * @returns
   */
  async summarizeCallgent(data: {
    callgent: {
      id: string;
      summary?: string;
      instruction?: string;
    };
    news?: Omit<Entry, 'securities' | 'createdAt'>[];
    olds?: Omit<Entry, 'securities' | 'createdAt'>[];
    totally?: boolean;
  }) {
    const result = await this.llmService.query('summarizeCallgent', data, {
      parseSchema: { summary: '', instruction: '', totally: true },
      bizKey: data.callgent.id,
    });

    return result;
  }

  async genVue1Route(data: {
    requirement: string;
    callgent: { name: string; summary: string; instruction: string };
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue1Route', data, {
      parseSchema: [
        {
          name: '',
          path: '',
          component: '',
          file: '',
          title: '',
          summary: '',
          instruction: '',
          distance: 0,
        },
      ],
      bizKey: data.bizKey,
    });

    return result;
  }

  async genVue2Components(data: {
    view: {
      name: string;
      path: string;
      file: string;
      title: string;
      summary: string;
      instruction: string;
    };
    otherViews: {
      name: string;
      path: string;
      title: string;
      summary: string;
    }[];
    components: {
      [comName: string]: {
        file: string;
        // props: string[];
        summary: string;
        instruction: string;
        inViews: string[];
      };
    };
    endpoints: {
      id: string;
      summary: string;
      description: string;
      params: [];
    }[];
    packages: string[];
    bizKey: string;
  }) {
    let compName = '';
    const result = await this.llmService.query('genVue2Components', data, {
      parseSchema: {
        [compName]: {
          file: '',
          endpoints: [''],
          // props: [''],
          summary: '',
          instruction: '',
        },
      },
      bizKey: data.bizKey,
      // validate endpoints exists
      validate: (gen) =>
        Object.entries(gen).every(([compName, comp]) =>
          comp.endpoints.every((epName) => {
            if (data.endpoints.find((ep) => (ep as any).name === epName))
              return true;
            throw new Error(
              `endpoint '${epName}' not found for component: ${compName}`,
            );
          }),
        ),
    });

    return result;
  }

  async genVue3Component(data: {
    components: {
      name: string;
      // props: string[];
      file?: string;
      summary: string;
      instruction?: string;
      endpoints?: { name: string; params: object; responses: object }[];
    }[];
    relatedViews: {
      name: string;
      title: string;
      summary: string;
      components: string[];
    }[];
    otherViews: {
      name: string;
      path: string;
      summary: string;
    }[];
    stores: {
      file: string;
      state: object;
      actions: string[];
      getters: object[];
    }[];
    packages: string[];
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue3Component', data, {
      parseSchema: {
        code: '',
        packages: [''],
        importedStores: [
          { file: '', name: '', state: {}, actions: [''], getters: [{}] },
        ],
        spec: {
          props: [''],
          slots: [{ name: '', summary: '' }],
          // events: [{ name: '', summary: '', payload: {} }],
          importedComponents: ['ComponentName', 'may empty array'],
        },
      },
      bizKey: data.bizKey,
      validate: (gen) =>
        gen.packages.every((p) => {
          if (p.lastIndexOf('@') <= 0)
            throw new Error('package name should be like `name@version`: ' + p);
          return true;
        }) &&
        (!gen.spec.importedComponents ||
          gen.spec.importedComponents.every((c) => {
            if (data.components.find((comp) => comp.name === c)) return true;
            throw new Error(
              `in $.spec.importedComponents: '${c}' isn't a self-defined components, must not listed here!`,
            );
          })),
    });

    return result;
  }

  async genVue4Store(data: {
    store: {
      file: string;
      state: object;
      actions: string[];
      getters: object[];
      endpoints: {
        name: any;
        summary: any;
        description: any;
        params: any;
        responses: any;
      }[];
    };
    packages: string[];
    apiBaseUrl: string;
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue4Store', data, {
      parseSchema: { code: '', packages: [''] },
      bizKey: data.bizKey,
      validate: (gen) =>
        gen.packages.every((p) => {
          if (p.lastIndexOf('@') <= 0)
            throw new Error('package name should be like `name@version`: ' + p);
          return true;
        }),
    });
    return result;
  }

  async genVue5View(data: {
    view: {
      name: string;
      title: string;
      path: string;
      summary: string;
      instruction: string;
      file: string;
    };
    otherViews: {
      name: string;
      title: string;
      path: string;
    }[];
    components: {
      name: string;
      // props: string[];
      summary: string;
      instruction: string;
      file: string;
      spec: object;
    }[];
    packages: string[];
    bizKey: string;
  }) {
    const result = await this.llmService.query('genVue5View', data, {
      parseSchema: { code: '', packages: [''] },
      bizKey: data.bizKey,
      validate: (gen) =>
        gen.packages?.every((p) => {
          if (p.lastIndexOf('@') > 0) return true;
          throw new Error('package name should be like `name@version`');
        }),
    });
    return result;
  }
}
