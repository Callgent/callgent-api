import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** request with requirement description */
export class RequestRequirement {
  @ApiProperty({
    type: 'object',
    description: 'Requirement for callgent to fulfill.',
    example:
      'I want to apply for the Senior Algorithm Engineer based in Singapore.',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  requirement: string;

  @ApiProperty({
    description:
      'When extract service invoking args from requirement, whether ignore optional or nullable service params if absent',
    type: 'boolean',
    default: true,
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true') // manual transform to boolean, for multipart form
  ignoreOptionalOrNullableParamsIfAbsentInRequirement = true;

  @ApiProperty({
    description:
      'When extract service invoking args from requirement, whether to use default value of service params if absent',
    type: 'boolean',
    default: true,
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true') // manual transform to boolean, for multipart form
  useDefaultParamValuesIfAbsentInRequirement = true;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
    description: 'Files to be uploaded',
    nullable: true,
    required: false,
  })
  @IsOptional()
  // @IsArray()
  files?: {
    filename: string;
    encoding: string;
    mimetype: string;
    size?: number;
  }[];
}
