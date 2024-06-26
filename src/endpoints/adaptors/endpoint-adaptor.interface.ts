import { ApiProperty } from '@nestjs/swagger';
import { EndpointDto } from '../dto/endpoint.dto';
import { ClientRequestEvent } from '../events/client-request.event';

export interface EndpointAdaptor {
  preprocess(reqEvent: ClientRequestEvent, endpoint: EndpointDto);
  /** Endpoint config. */
  getConfig(): EndpointConfig;

  /** init the endpoint. result in generated content */
  initClient(initParams: object, endpoint: EndpointDto): Promise<string>;
  initServer(initParams: object, endpoint: EndpointDto): Promise<string>;

  /** parse api spec from text */
  parseApis(apiTxt: { text: string; format?: string }): Promise<ApiSpec>;

  /** please declare hints in api-doc */
  readData(name: string, hints?: { [key: string]: any }): Promise<any>;
  invoke(params: object): Promise<any>;
  /** get callback param */
  getCallback(
    callback: string,
    rawReq: unknown,
    reqEndpoint?: EndpointDto,
  ): Promise<string>;
  /** send response back to client */
  callback(resp: any): Promise<boolean>;
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
