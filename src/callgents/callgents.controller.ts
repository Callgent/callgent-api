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
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { JwtGuard } from '../infras/auth/jwt/jwt.guard';
import { Utils } from '../infras/libs/utils';
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
      anyOf: [
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
  @ApiQuery({ name: 'mainTagId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({
    name: 'orderBy',
    description:
      'e.g. createdAt:desc,price:asc. Allowed fields: name, favorite, featured, forked, liked, official, viewed, mainTagId, pk, updatedAt',
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    schema: {
      anyOf: [
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
  async list(
    @Query()
    {
      query,
      mainTagId,
      page,
      perPage,
      orderBy: orders,
    }: {
      query?: string;
      mainTagId?: number;
      page?: 1;
      perPage?: 10;
      orderBy?: string;
    },
  ) {
    query = query?.trim();
    let where: Prisma.CallgentWhereInput = query
      ? { name: { contains: query } }
      : undefined;
    mainTagId &&
      (where ? (where.mainTagId = mainTagId) : (where = { mainTagId }));

    const orderBy: Prisma.CallgentOrderByWithRelationInput[] =
      Utils.parseOrderBy(orders, [
        'name',
        'favorite',
        'featured',
        'forked',
        'liked',
        'official',
        'viewed',
        'mainTagId',
        'pk',
        'updatedAt',
      ]);

    const list = await this.callgentsService.findMany({
      page,
      perPage,
      where,
      orderBy,
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
