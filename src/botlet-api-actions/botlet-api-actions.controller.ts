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
import { BotletApiActionsService } from './botlet-api-actions.service';
import { BotletApiActionDto } from './dto/botlet-api-action.dto';
import { UpdateBotletApiActionDto } from './dto/update-botlet-api-action.dto';

export class BotletApis extends ApiSpec {
  @EntityIdExists('endpoint', 'uuid')
  endpointUuid: string;
}

export class BotletApiText {
  @EntityIdExists('endpoint', 'uuid')
  endpointUuid: string;
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

@ApiTags('BotletApiActions')
@ApiBearerAuth('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, BotletApiActionDto)
@UseGuards(JwtGuard)
@Controller('botlet-actions')
export class BotletApiActionsController {
  constructor(
    private readonly botletApiActionService: BotletApiActionsService,
  ) {}

  @ApiOperation({
    summary:
      'Create batch of new BotletApiAction. Exception if existing one with same name in the same botlet',
    description: 'return { data: count } on success',
  })
  @Post()
  async createBatch(
    @Req() req,
    @Body()
    apis: BotletApis,
  ) {
    const endpoint = EntityIdExists.entity<EndpointDto>(apis, 'endpointUuid');
    return {
      data: await this.botletApiActionService.createBatch(
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
    const endpoint = EntityIdExists.entity<EndpointDto>(apiTxt, 'endpointUuid');
    return {
      data: await this.botletApiActionService.importBatch(
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
            data: { $ref: getSchemaPath(BotletApiActionDto) },
          },
        },
      ],
    },
  })
  @Get('/:uuid')
  async findOne(@Param('uuid') uuid: string) {
    return { data: await this.botletApiActionService.findOne(uuid) };
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
              items: { $ref: getSchemaPath(BotletApiActionDto) },
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
    return this.botletApiActionService.findAll({
      page: query.page,
      perPage: query.perPage,
      where,
    });
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(BotletApiActionDto) } } },
      ],
    },
  })
  @Put('/:uuid')
  async update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateBotletApiActionDto,
  ) {
    dto.uuid = uuid;
    return { data: await this.botletApiActionService.update(dto) };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(BotletApiActionDto) },
          },
        },
      ],
    },
  })
  @Delete('/:uuid')
  async delete(@Param('uuid') uuid: string) {
    return { data: await this.botletApiActionService.delete(uuid) };
  }
}
