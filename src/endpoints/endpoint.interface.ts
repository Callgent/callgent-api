import { ApiProperty } from '@nestjs/swagger';
import { EndpointDto } from './dto/endpoint.dto';

export interface EndpointInterface {
  /** Endpoint config. */
  getConfig(): EndpointConfig;

  /** init the endpoint. result in generated content */
  initReceiver(initParams: object, endpoint: EndpointDto): Promise<string>;
  initSender(initParams: object, endpoint: EndpointDto): Promise<string>;
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
  value?: any;
  @ApiProperty()
  constraint?: string;
  @ApiProperty()
  position?: number | 'bottom' | 'top';
}

class EndpointEntry {
  @ApiProperty({
    description: 'entry address',
    example: 'task+1234567890@botlet.io',
  })
  address: EndpointParam;

  @ApiProperty({
    description: 'default auth type',
    enum: ['NONE', 'APP', 'USER'],
  })
  authType?: 'NONE' | 'APP' | 'USER';

  @ApiProperty({ description: 'Authentication params' })
  params?: EndpointParam[];
}

class Endpoint {
  @ApiProperty({
    description: 'Optional endpoint entry, overrides the entry in endpoint',
  })
  entry?: EndpointEntry;
  @ApiProperty({ description: 'Endpoint requesting params template' })
  params?: EndpointParam[];
  @ApiProperty({ description: 'Whether allow additional params' })
  addParams?: boolean;
  @ApiProperty({ description: 'Endpoint initialization params template' })
  initParams?: EndpointParam[];
}

export class EndpointConfig {
  @ApiProperty({ description: 'Endpoint entry' })
  entry: EndpointEntry;

  @ApiProperty({ description: 'The task receiver' })
  receiver?: Endpoint;

  @ApiProperty({ description: 'The task sender' })
  sender?: Endpoint;
}
