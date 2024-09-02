import $RefParser from '@apidevtools/json-schema-ref-parser';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { AgentsService } from '../../agents/agents.service';
import { EndpointDto } from '../dto/endpoint.dto';
import { ClientRequestEvent } from '../events/client-request.event';
import yaml from 'yaml';
import { Prisma } from '@prisma/client';
import { CallgentFunctionDto } from '../../callgent-functions/dto/callgent-function.dto';

export abstract class EndpointAdaptor {
  protected readonly agentsService: AgentsService;
  constructor(agentsService: AgentsService) {
    this.agentsService = agentsService;
  }

  abstract preprocess(reqEvent: ClientRequestEvent, endpoint: EndpointDto);
  /** Endpoint config. */
  abstract getConfig(): EndpointConfig;

  /** init the endpoint. result in generated content */
  abstract initClient(
    initParams: object,
    endpoint: EndpointDto,
  ): Promise<string>;
  abstract initServer(
    initParams: object,
    endpoint: EndpointDto,
  ): Promise<string>;

  /** please declare hints in api-doc */
  abstract readData(name: string, hints?: { [key: string]: any }): Promise<any>;
  /** get callback param */
  abstract getCallback(
    callback: string,
    rawReq: unknown,
    reqEndpoint?: EndpointDto,
  ): Promise<string>;

  /** send response back to client */
  abstract callback(resp: any): Promise<boolean>;

  /** parse api to openAPI.JSON format */
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
      }

      if (!json?.openapi || !json.paths) {
        // convert text to openAPI.JSON
        throw new Error('Not implemented.');
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
        'Invalid openAPI.JSON, failed to dereference.',
      );
    }
    const { paths, components } = json; // TODO: save components onto SEP

    const ps = paths && Object.entries(paths);
    if (ps?.length) {
      for (const [path, pathApis] of ps) {
        const entries = Object.entries(pathApis);
        for (const [method, restApi] of entries) {
          const summary = `${
            restApi.operationId ? restApi.operationId + ': ' : ''
          }${restApi.summary}`;
          const description = restApi.description;

          delete restApi.summary;
          delete restApi.description;
          delete restApi.operationId;
          ret.apis.push({
            path: path.toLowerCase(),
            method: method.toUpperCase(),
            summary,
            description,
            signature: restApi,
          });
        }
      }
      return ret;
    }
    throw new NotFoundException('No API found in the text.');
  }

  abstract invoke(
    fun: CallgentFunctionDto,
    args: object,
    sep: EndpointDto,
    reqEvent: ClientRequestEvent,
  ): Promise<any>;
}

export interface AdaptedDataSource {}

export class ApiSpec {
  apis: {
    path: string;
    method: string;
    summary: string;
    description: string;
    signature: Prisma.JsonObject;
  }[];
}

export class EndpointParam {
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
  value?: any | { [key: string]: EndpointParam[] };
  @ApiProperty()
  constraint?: string;
  @ApiProperty()
  position?: number | 'bottom' | 'top';
  // @ApiProperty()
  // hidden?: boolean | (form: object) => boolean;
}

class EndpointHost {
  @ApiProperty({
    description: 'host address',
    example: 'task+sdfhjw4349fe@my.callgent.com',
  })
  address: EndpointParam;

  @ApiProperty({
    description: 'default auth type',
    enum: ['NONE', 'APP', 'USER'],
  })
  authType?: 'NONE' | 'APP' | 'USER';

  @ApiProperty({ description: 'Authentication Configuration' })
  authConfig?: EndpointParam[];
}

class Endpoint {
  @ApiProperty({
    description: 'Optional endpoint host config',
  })
  host?: EndpointHost;
  @ApiProperty({ description: 'Endpoint requesting params template' })
  params?: EndpointParam[];
  @ApiProperty({ description: 'Whether allow additional params' })
  addParams?: boolean;
  @ApiProperty({ description: 'Endpoint initialization params template' })
  initParams?: EndpointParam[];
}

export class EndpointConfig {
  @ApiProperty({ description: 'Endpoint host' })
  host?: EndpointHost;

  @ApiProperty({ description: 'The task client endpoint' })
  client?: Endpoint;

  @ApiProperty({ description: 'The task server endpoint' })
  server?: Endpoint;
}
