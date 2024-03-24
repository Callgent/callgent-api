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
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { RestApiResponse } from '../restapi/response.interface';
import { BotletsService } from './botlets.service';
import { BotletDto } from './dto/botlet.dto';
import { CreateBotletDto } from './dto/create-botlet.dto';
import { UpdateBotletDto } from './dto/update-botlet.dto';

@ApiTags('Botlets')
@ApiBearerAuth('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, BotletDto)
@UseGuards(JwtGuard)
@Controller('botlets')
export class BotletsController {
  constructor(private readonly botletService: BotletsService) {}

  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(BotletDto) } } },
      ],
    },
  })
  @Post()
  async create(@Req() req, @Body() dto: CreateBotletDto) {
    return {
      data: await this.botletService.create({
        ...dto,
        createdBy: req.user.sub,
      }),
    };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(BotletDto) } } },
      ],
    },
  })
  @Get('/:uuid')
  async findOne(@Param('uuid') uuid: string) {
    return { data: await this.botletService.findOne(uuid) };
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
            data: { type: 'array', items: { $ref: getSchemaPath(BotletDto) } },
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
    return this.botletService.findAll({
      page: query.page,
      perPage: query.perPage,
      where,
    });
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(BotletDto) } } },
      ],
    },
  })
  @Put('/:uuid')
  async update(@Param('uuid') uuid: string, @Body() dto: UpdateBotletDto) {
    dto.uuid = uuid;
    return { data: await this.botletService.update(dto) };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(BotletDto) },
          },
        },
      ],
    },
  })
  @Delete('/:uuid')
  async delete(@Param('uuid') uuid: string) {
    return { data: await this.botletService.delete(uuid) };
  }

  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(BotletDto) } } },
      ],
    },
  })
  @Post('duplicate/:uuid')
  async duplicateOverTenancy(
    @Param('uuid') uuid: string,
    @Req() req,
    @Body() dto: CreateBotletDto,
  ) {
    return {
      data: await this.botletService.duplicateOverTenancy(uuid, {
        ...dto,
        createdBy: req.user.sub,
      }),
    };
  }
}
