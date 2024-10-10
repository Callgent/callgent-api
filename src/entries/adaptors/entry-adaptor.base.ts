import $RefParser from '@apidevtools/json-schema-ref-parser';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  SecurityRequirementObject,
  SecuritySchemeObject,
  ServerObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { Prisma } from '@prisma/client';
import yaml from 'yaml';
import { AgentsService } from '../../agents/agents.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { EntryDto } from '../dto/entry.dto';
import { ClientRequestEvent } from '../events/client-request.event';

export abstract class EntryAdaptor {
  protected readonly agentsService: AgentsService;
  constructor(agentsService: AgentsService) {
    this.agentsService = agentsService;
  }

  /** preprocess request, replace raw request */
  abstract preprocess(
    reqEvent: ClientRequestEvent,
    entry: EntryDto,
  ): Promise<void>;

  /** postprocess response */
  abstract postprocess(
    reqEvent: ClientRequestEvent,
    fun: EndpointDto,
  ): Promise<void>;

  /** Entry config. */
  abstract getConfig(): EntryConfig;

  /** init the entry. result in generated content */
  abstract initClient(initParams: object, entry: EntryDto): Promise<string>;
  abstract initServer(initParams: object, entry: EntryDto): Promise<string>;

  /** please declare hints in api-doc */
  abstract readData(name: string, hints?: { [key: string]: any }): Promise<any>;
  /** get callback param */
  abstract getCallback(callback: string, reqEntry?: EntryDto): Promise<string>;

  /** send response back to client */
  abstract callback(resp: any): Promise<boolean>;

  /**
   * parse APIs to openAPI.json format
   * @see https://github.com/OAI/OpenAPI-Specification/blob/main/schemas/v3.0/schema.json
   */
  async parseApis({
    text,
    format,
  }: {
    text: string;
    format?: 'json' | 'yaml' | 'text';
  }) {
    const ret: ApiSpec = { apis: [] };

    let json: any;
    try {
      if (format == 'yaml') {
        json = yaml.parse(text);
      } else if (format == 'json') {
        json = JSON.parse(text);
      } else {
        try {
          json = JSON.parse(text);
        } catch (err) {
          try {
            json = yaml.parse(text);
          } catch (err) {
            // pass
          }
        }
      }

      if (!json?.openapi || !json.paths) {
        // convert text to openAPI.JSON
        throw new Error('TODO: Not implemented.');
      }
    } catch (err) {
      throw new BadRequestException(
        `Failed to parse content as ${format || 'text'} format, msg: ${
          err.message
        }`,
      );
    }
    try {
      json = await $RefParser.dereference(json);
    } catch (err) {
      throw new BadRequestException(
        'Invalid openAPI.JSON, failed to dereference, ' + err.message,
      );
    }
    const { openapi, paths, components, security, servers } = json; // TODO: save components onto SEP
    if (!openapi?.startsWith('3.0'))
      throw new BadRequestException(
        'Only openAPI `3.0.x` is supported now, openapi=' + openapi,
      );
    ret.securitySchemes = components?.securitySchemes;
    ret.servers = servers;
    ret.securities = security;

    const ps = paths && Object.entries(paths);
    if (ps?.length) {
      for (const [path, pathApis] of ps) {
        const entries = Object.entries(pathApis);
        for (const [method, restApi] of entries) {
          const summary = `${
            restApi.operationId ? restApi.operationId + ': ' : ''
          }${restApi.summary}`;
          let description = restApi.description || '';
          if (restApi.tags?.length)
            description += ` Tags: ${restApi.tags.join(', ')}`;
          const responses = restApi.responses;
          const params = {
            parameters: restApi.parameters,
            requestBody: restApi.requestBody,
          };
          const securities = restApi.security;

          // TODO restApi.callbacks

          ret.apis.push({
            path: path.toLowerCase(),
            method: method.toUpperCase(),
            summary,
            description,
            securities,
            params,
            responses,
            rawJson: restApi,
          });
        }
      }
      return ret;
    }
    throw new NotFoundException('No API found in the text.');
  }

  abstract invoke(
    fun: EndpointDto,
    args: object,
    sep: EntryDto,
    reqEvent: ClientRequestEvent,
  ): Promise<void | { data: ClientRequestEvent; resumeFunName?: string }>;
}

export class ApiSpec {
  apis: {
    path: string;
    method: string;
    summary: string;
    description: string;
    /** array with or-relation, SecurityRequirementObject with and-relation */
    securities?: SecurityRequirementObject[];
    params: Prisma.JsonObject;
    responses: Prisma.JsonObject;
    rawJson: Prisma.JsonObject;
  }[];
  securitySchemes?: {
    [name: string]: SecuritySchemeObject & { provider?: string };
  };
  servers?: ServerObject[];
  /** array with or-relation, SecurityRequirementObject with and-relation */
  securities?: SecurityRequirementObject[];
}

export class EntryParam {
  @ApiProperty({
    description:
      'param type. `readonly` shows some instructions in markdown format',
  })
  type:
    | 'text'
    | 'textarea'
    | 'integer'
    | 'float'
    | 'boolean'
    | 'date'
    | 'time'
    | 'datetime'
    | 'password'
    | 'email'
    | 'tel'
    | 'url'
    | 'domain'
    | 'cron'
    | 'regex'
    | 'file'
    | 'image'
    | 'radio'
    | 'select'
    | 'checkbox'
    | 'multiselect'
    | 'range'
    | 'slider'
    | 'color'
    | 'yaml'
    | 'json'
    | 'markdown'
    | 'file'
    | 'image'
    | 'script'
    | 'readonly';
  @ApiProperty({ description: 'Param name' })
  name: string;
  @ApiProperty({ description: 'Default to param name' })
  label?: string;
  @ApiProperty()
  placeholder?: string;
  @ApiProperty()
  optional?: boolean;
  @ApiProperty({ description: 'Default value, or select options' })
  value?: any | { [key: string]: EntryParam[] };
  @ApiProperty()
  constraint?: string;
  @ApiProperty()
  position?: number | 'bottom' | 'top';
  // @ApiProperty()
  // hidden?: boolean | (form: object) => boolean;
}

class EntryHost {
  @ApiProperty({
    description: 'host address',
    example: 'task+sdfhjw4349fe@my.callgent.com',
  })
  address: EntryParam;

  @ApiProperty({
    description: 'default auth type',
    enum: ['NONE', 'APP', 'USER'],
  })
  authType?: 'NONE' | 'APP' | 'USER';

  @ApiProperty({ description: 'Authentication Configuration' })
  authConfig?: EntryParam[];
}

class Entry {
  @ApiProperty({
    description: 'Optional entry host config',
  })
  host?: EntryHost;
  @ApiProperty({ description: 'Entry requesting params template' })
  params?: EntryParam[];
  @ApiProperty({ description: 'Whether allow additional params' })
  addParams?: boolean;
  @ApiProperty({ description: 'Entry initialization params template' })
  initParams?: EntryParam[];
}

export class EntryConfig {
  @ApiProperty({ description: 'Entry host' })
  host?: EntryHost;

  @ApiProperty({ description: 'The task client entry' })
  client?: Entry;

  @ApiProperty({ description: 'The task server entry' })
  server?: Entry;
}
