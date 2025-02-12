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
import { CreateEntryDto } from './dto/create-entry.dto';
import { EntryDto } from './dto/entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntriesService } from './entries.service';

@ApiTags('Entries')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(EntryDto)
@Controller('entries')
export class EntriesController {
  constructor(
    @Inject('EntriesService')
    private readonly entriesService: EntriesService,
  ) {}

  @ApiOkResponse({
    description: 'returns { [adaptorKey: string]: "icon-url" }',
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: {
              type: 'object',
              additionalProperties: {
                type: 'string',
              },
            },
          },
        },
      ],
    },
  })
  @Get('adaptors')
  listAdaptors(@Query('client') client?: boolean) {
    return { data: this.entriesService.listAdaptors(client) };
  }

  // @ApiOkResponse({ type: EntryConfig })
  // @Get(':endpointType/config')
  // getConfig(@Param('endpointType') endpointType: EntryType) {
  //   return this.entriesService.getAdaptor(endpointType);
  //   if (!adaptor)
  //     throw new NotFoundException('No entry found with key:', endpointType);
  //   return adaptor.getConfig();
  // }

  @ApiCreatedResponse({
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(EntryDto) } } },
      ],
    },
  })
  @UseGuards(JwtGuard)
  @Post(':adaptorKey/create')
  async createEntry(
    @Req() req,
    @Param('adaptorKey') adaptorKey: string,
    @Body() dto: CreateEntryDto,
  ) {
    return {
      data: await this.entriesService.create({
        ...dto,
        adaptorKey,
        createdBy: req.user.sub,
      }),
    };
  }

  @ApiOkResponse({
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(EntryDto) } } },
      ],
    },
  })
  @UseGuards(JwtGuard)
  @Put(':id')
  async updateEntry(@Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return {
      data: await this.entriesService.update(id, dto),
    };
  }

  /** for auth type `APP`, userKey is ignored */
  // @Put('auth')
  // async upsertEntryAuth(@Req() req, @Body() dto: CreateEntryAuthDto) {
  //   const entry = EntityIdExists.entity<EntryDto>(dto, 'entry');
  //   return {
  //     data: await this.entriesService.upsertEntryAuth(
  //       { ...dto, createdBy: req.user.sub },
  //       entry,
  //     ),
  //   };
  // }

  @Post(':id/init')
  @UseGuards(JwtGuard)
  initEntry(@Param('id') id: string, @Body() initParams: object) {
    this.entriesService.init(id, initParams);
  }

  // /** manual test entry */
  // @Post(':id/test')
  // @UseGuards(JwtGuard)
  // testEntry(@Param('id') id: string, @Body() any: any) {
  //   //
  // }

  @ApiOkResponse({
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(EntryDto) },
          },
        },
      ],
    },
  })
  @UseGuards(JwtGuard)
  @Delete('/:id')
  async remove(@Param('id') id: string) {
    return { data: await this.entriesService.delete(id) };
  }

  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({
    name: 'adaptor',
    description: 'Service adaptor type',
    required: false,
    type: String,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({
    name: 'orderBy',
    description:
      'e.g. createdAt:desc,price:asc. Allowed fields: name,type,adaptorKey,host,createdAt,updatedAt',
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    description: 'List of server entries',
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(EntryDto) },
            },
          },
        },
      ],
    },
  })
  @UseGuards(JwtGuard)
  @Get('server')
  list(
    @Query()
    {
      query,
      adaptor: adaptorKey,
      page,
      perPage,
      orderBy: orders,
    }: {
      query?: string;
      adaptor?: string;
      page?: 1;
      perPage?: 10;
      orderBy?: string;
    },
  ) {
    const where: Prisma.EntryWhereInput = { type: 'SERVER', adaptorKey };
    if (query?.trim()) where.name = { contains: query.trim() };
    const orderBy: Prisma.EntryOrderByWithRelationInput[] = Utils.parseOrderBy(
      orders,
      ['name', 'type', 'adaptorKey', 'host', 'createdAt', 'updatedAt'],
    );
    return this.entriesService.findMany({ page, perPage, where, orderBy });
  }
}
