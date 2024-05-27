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
  ApiSecurity,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { RestApiResponse } from '../restapi/response.interface';
import { CallgentsService } from './callgents.service';
import { CallgentDto } from './dto/callgent.dto';
import { CreateCallgentDto } from './dto/create-callgent.dto';
import { UpdateCallgentDto } from './dto/update-callgent.dto';

@ApiTags('Callgents')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, CallgentDto)
@UseGuards(JwtGuard)
@Controller('callgents')
export class CallgentsController {
  constructor(private readonly callgentService: CallgentsService) {}

  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @Post()
  async create(@Req() req, @Body() dto: CreateCallgentDto) {
    return {
      data: await this.callgentService.create(dto, req.user.sub),
    };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @Get('/:uuid')
  async findOne(@Param('uuid') uuid: string) {
    return { data: await this.callgentService.findOne(uuid) };
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
            data: { type: 'array', items: { $ref: getSchemaPath(CallgentDto) } },
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
    return this.callgentService.findAll({
      page: query.page,
      perPage: query.perPage,
      where,
    });
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @Put('/:uuid')
  async update(@Param('uuid') uuid: string, @Body() dto: UpdateCallgentDto) {
    dto.uuid = uuid;
    return { data: await this.callgentService.update(dto) };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(CallgentDto) },
          },
        },
      ],
    },
  })
  @Delete('/:uuid')
  async delete(@Param('uuid') uuid: string) {
    return { data: await this.callgentService.delete(uuid) };
  }

  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @Post(':uuid/duplicate')
  async duplicateOverTenancy(
    @Param('uuid') uuid: string,
    @Req() req,
    @Body() dto: CreateCallgentDto,
  ) {
    return {
      data: await this.callgentService.duplicateOverTenancy(
        uuid,
        dto,
        req.user.sub,
      ),
    };
  }
}
