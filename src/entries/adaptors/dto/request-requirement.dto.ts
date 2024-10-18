import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

/** request with requirement description */
export class RequestRequirement {
  @ApiProperty({
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
    default: true,
  })
  @IsBoolean()
  ignoreOptionalOrNullableParamsIfAbsentInRequirement = true;

  @ApiProperty({
    description:
      'When extract service invoking args from requirement, whether to use default value of service params if absent',
    default: true,
  })
  @IsBoolean()
  useDefaultParamValuesIfAbsentInRequirement = true;
}
