import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { BotletFunctionsService } from './botlet-functions.service';
import { BotletFunctionDto } from './dto/botlet-function.dto';
import { UpdateBotletFunctionDto } from './dto/update-botlet-function.dto';

export class BotletApis extends ApiSpec {
  @EntityIdExists('endpoint', 'uuid')
  endpoint: string;
}

export class BotletApiText {
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

@ApiTags('BotletFunctions')
@ApiBearerAuth('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, BotletFunctionDto)
@UseGuards(JwtGuard)
@Controller('botlet-functions')
export class BotletFunctionsController {
  constructor(private readonly BotletFunctionService: BotletFunctionsService) {}

  @ApiOperation({
    summary:
      'Create batch of new BotletFunction. Exception if existing one with same name in the same botlet',
    description: 'return { data: count } on success',
  })
  @Post()
  async createBatch(
    @Req() req,
    @Body()
    apis: BotletApis,
  ) {
    const endpoint = EntityIdExists.entity<EndpointDto>(apis, 'endpoint');
    return {
      data: await this.BotletFunctionService.createBatch(
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
    apiTxt: BotletApiText,
  ) {
    const endpoint = EntityIdExists.entity<EndpointDto>(apiTxt, 'endpoint');
    return {
      data: await this.BotletFunctionService.importBatch(
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
            data: { $ref: getSchemaPath(BotletFunctionDto) },
          },
        },
      ],
    },
  })
  @Get('/:uuid')
  async findOne(@Param('uuid') uuid: string) {
    return { data: await this.BotletFunctionService.findOne(uuid) };
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
              items: { $ref: getSchemaPath(BotletFunctionDto) },
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
    return this.BotletFunctionService.findAll({
      page: query.page,
      perPage: query.perPage,
      where,
    });
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(BotletFunctionDto) } } },
      ],
    },
  })
  @Put('/:uuid')
  async update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateBotletFunctionDto,
  ) {
    dto.uuid = uuid;
    return { data: await this.BotletFunctionService.update(dto) };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(BotletFunctionDto) },
          },
        },
      ],
    },
  })
  @Delete('/:uuid')
  async delete(@Param('uuid') uuid: string) {
    return { data: await this.BotletFunctionService.delete(uuid) };
  }
}
