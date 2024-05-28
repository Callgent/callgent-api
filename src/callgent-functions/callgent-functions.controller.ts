import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiSecurity,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { ApiSpec } from '../endpoints/adaptors/endpoint-adaptor.interface';
import { EndpointDto } from '../endpoints/dto/endpoint.dto';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { EntityIdExists } from '../infra/repo/validators/entity-exists.validator';
import { RestApiResponse } from '../restapi/response.interface';
import { CallgentFunctionsService } from './callgent-functions.service';
import { CallgentFunctionDto } from './dto/callgent-function.dto';
import { UpdateCallgentFunctionDto } from './dto/update-callgent-function.dto';

export class CallgentApis extends ApiSpec {
  @EntityIdExists('endpoint', 'uuid')
  endpoint: string;
}

export class CallgentApiText {
  @ApiProperty({
    required: true,
    description: 'The callgent server-endpoint uuid',
  })
  @IsNotEmpty()
  @EntityIdExists('endpoint', 'uuid')
  endpoint: string;

  @ApiProperty({
    required: true,
    description: 'The api content text to parse',
  })
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    required: false,
    description: 'The format of the api content text',
  })
  @IsOptional()
  format?: string;
}

@ApiTags('CallgentFunctions')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, CallgentFunctionDto)
@UseGuards(JwtGuard)
@Controller('callgent-functions')
export class CallgentFunctionsController {
  constructor(
    @Inject('CallgentFunctionsService')
    private readonly CallgentFunctionService: CallgentFunctionsService,
  ) {}

  @ApiOperation({
    summary:
      'Create batch of new CallgentFunction. Exception if existing one with same name in the same callgent',
    description: 'return { data: count } on success',
  })
  @Post()
  async createBatch(
    @Req() req,
    @Body()
    apis: CallgentApis,
  ) {
    const endpoint = EntityIdExists.entity<EndpointDto>(apis, 'endpoint');
    return {
      data: await this.CallgentFunctionService.createBatch(
        endpoint,
        apis,
        req.user?.sub,
      ),
    };
  }

  @ApiOperation({
    summary: 'Parse import text and create batch.',
    description: 'return { data: count } on success',
  })
  @Post('import')
  async importBatch(
    @Req() req,
    @Body()
    apiTxt: CallgentApiText,
  ) {
    const endpoint = EntityIdExists.entity<EndpointDto>(apiTxt, 'endpoint');
    return {
      data: await this.CallgentFunctionService.importBatch(
        endpoint,
        apiTxt,
        req.user?.sub,
      ),
    };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(CallgentFunctionDto) },
          },
        },
      ],
    },
  })
  @Get('/:uuid')
  async findOne(@Param('uuid') uuid: string) {
    return { data: await this.CallgentFunctionService.findOne(uuid) };
  }

  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CallgentFunctionDto) },
            },
          },
        },
      ],
    },
  })
  @Get()
  async findAll(
    @Query() query: { queryString?: string; page?: 1; perPage?: 10 },
  ) {
    const where = query.queryString
      ? {
          name: { contains: query.queryString },
        }
      : undefined;
    return this.CallgentFunctionService.findAll({
      page: query.page,
      perPage: query.perPage,
      where,
    });
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentFunctionDto) } } },
      ],
    },
  })
  @Put('/:uuid')
  async update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateCallgentFunctionDto,
  ) {
    dto.uuid = uuid;
    return { data: await this.CallgentFunctionService.update(dto) };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(CallgentFunctionDto) },
          },
        },
      ],
    },
  })
  @Delete('/:uuid')
  async delete(@Param('uuid') uuid: string) {
    return { data: await this.CallgentFunctionService.delete(uuid) };
  }
}
