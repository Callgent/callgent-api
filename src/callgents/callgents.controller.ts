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
  constructor(private readonly callgentsService: CallgentsService) {}

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
      data: await this.callgentsService.create(dto, req.user.sub),
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
  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return { data: await this.callgentsService.findOne(id) };
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
              items: { $ref: getSchemaPath(CallgentDto) },
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
    const list = await this.callgentsService.findMany({
      page: query.page,
      perPage: query.perPage,
      where,
    });
    list.data?.forEach((item: any) => (item.children = []));
    return list;
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @Put('/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateCallgentDto) {
    dto.id = id;
    return { data: await this.callgentsService.update(dto) };
  }

  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @Post(':id/duplicate')
  async duplicateOverTenancy(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: CreateCallgentDto,
  ) {
    return {
      data: await this.callgentsService.duplicateOverTenancy(
        id,
        dto,
        req.user.sub,
      ),
    };
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
  @Delete('/:id')
  async remove(@Param('id') id: string) {
    return { data: await this.callgentsService.delete(id) };
  }
}
