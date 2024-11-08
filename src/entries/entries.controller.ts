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
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { RestApiResponse } from '../restapi/response.interface';
import { CreateEntryDto } from './dto/create-entry.dto';
import { EntryDto } from './dto/entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntriesService } from './entries.service';

@ApiTags('Entries')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(EntryDto)
@UseGuards(JwtGuard)
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
  initEntry(@Param('id') id: string, @Body() initParams: object) {
    this.entriesService.init(id, initParams);
  }

  /** manual test entry */
  @Post(':id/test')
  testEntry(@Param('id') id: string, @Body() any: any) {
    //
  }

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
  @Delete('/:id')
  async remove(@Param('id') id: string) {
    return { data: await this.entriesService.delete(id) };
  }
}
