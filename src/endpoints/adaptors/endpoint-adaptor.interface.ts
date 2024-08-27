import $RefParser from '@apidevtools/json-schema-ref-parser';
import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { AgentsService } from '../../agents/agents.service';
import { EndpointDto } from '../dto/endpoint.dto';
import { ClientRequestEvent } from '../events/client-request.event';

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
  abstract invoke(params: object): Promise<any>;
  /** get callback param */
  abstract getCallback(
    callback: string,
    rawReq: unknown,
    reqEndpoint?: EndpointDto,
  ): Promise<string>;

  /** send response back to client */
  abstract callback(resp: any): Promise<boolean>;

  /** parse api spec from text */
  async parseApis({ text, format }: { text: string; format?: string }) {
    const ret: ApiSpec = { apis: [] };

    if (!format || format === 'openAPI') {
      let json = JSON.parse(text);
      try {
        json = await $RefParser.dereference(json);
      } catch (err) {
        throw new BadRequestException('Only openAPI.JSON is supported');
      }
      const { paths } = json;

      if (paths) {
        const ps = Object.entries(paths);
        for (const [path, pathApis] of ps) {
          const entries = Object.entries(pathApis);
          for (const [method, restApi] of entries) {
            // wrap schema

            const apiName = EndpointAdaptor.formalActionName(method, path);
            const func = await this.agentsService.api2Function(
              'restAPI',
              '(req:{ path: string; method: string; headers?: { [key: string]: string }; query?: { [key: string]: string }; params?: { [key: string]: string }; files?: { [key: string]: any }; body?: any; form?: any;})=>Promise<{ apiResult: any; headers?: { [key: string]: string }; status?: number; statusText?: string;}>',
              {
                apiName,
                apiContent: JSON.stringify(restApi),
              },
            );
            ret.apis.push({
              name: apiName,
              ...func,
              content: restApi,
            });
          }
        }
      }

      return ret;
    }

    throw new BadRequestException('Only openAPI.JSON is supported');
  }

  static formalActionName = (method, path) =>
    `${(method || 'GET').toUpperCase()}:${path}`;
}

export interface AdaptedDataSource {}

export class ApiSpec {
  apis: {
    name: string;
    funName: string;
    params: string[];
    documents: string;
    fullCode: string;
    content: any;
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
