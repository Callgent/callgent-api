import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';
import { ApiSpec } from '../entries/adaptors/entry-adaptor.base';
import { EntryDto } from '../entries/dto/entry.dto';
import { JwtGuard } from '../infras/auth/jwt/jwt.guard';
import { EntityIdExists } from '../infras/repo/validators/entity-exists.validator';
import { RestApiResponse } from '../restapi/response.interface';
import { EndpointsService } from './endpoints.service';
import { EndpointDto } from './dto/endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

export class CallgentApis extends ApiSpec {
  @EntityIdExists('entry', 'id')
  entryId: string;
}

export class CallgentApiText {
  @ApiProperty({
    required: true,
    description: 'The callgent server-entry id',
  })
  @IsNotEmpty()
  @EntityIdExists('entry', 'id')
  entryId: string;

  @ApiProperty({
    required: true,
    description: 'The api content text to parse',
  })
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    required: false,
    description: 'The format of the api content: json, yaml, text',
    enum: ['json', 'yaml', 'text'],
  })
  @IsOptional()
  format?: 'json' | 'yaml' | 'text';
}

@ApiTags('Endpoints')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, EndpointDto)
@UseGuards(JwtGuard)
@Controller('endpoints')
export class EndpointsController {
  constructor(
    @Inject('EndpointsService')
    private readonly endpointService: EndpointsService,
  ) {}

  @ApiOperation({
    summary:
      'Create batch of new Endpoint. Exception if existing one with same name in the same callgent',
    description: 'return { data: imported_functions_count } on success',
  })
  @Post()
  async createBatch(
    @Req() req,
    @Body()
    apis: CallgentApis,
  ) {
    const entry = EntityIdExists.entity<EntryDto>(apis, 'entryId');
    return {
      data: await this.endpointService.createBatch(entry, apis, req.user?.sub),
    };
  }

  @ApiOperation({
    summary: 'Parse import text and create batch.',
    description: 'return { data: imported_functions_count } on success',
  })
  @Post('import')
  async importBatch(
    @Req() req,
    @Body()
    apiTxt: CallgentApiText,
  ) {
    const entry = EntityIdExists.entity<EntryDto>(apiTxt, 'entryId');
    return {
      data: await this.endpointService.importBatch(
        entry,
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
            data: { $ref: getSchemaPath(EndpointDto) },
          },
        },
      ],
    },
  })
  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return { data: await this.endpointService.findOne(id) };
  }

  // @ApiQuery({ name: 'query', required: false, type: String })
  // @ApiQuery({ name: 'page', required: false, type: Number })
  // @ApiQuery({ name: 'perPage', required: false, type: Number })
  // @ApiOkResponse({
  //   schema: {
  //     allOf: [
  //       { $ref: getSchemaPath(RestApiResponse) },
  //       {
  //         properties: {
  //           data: {
  //             type: 'array',
  //             items: { $ref: getSchemaPath(EndpointDto) },
  //           },
  //         },
  //       },
  //     ],
  //   },
  // })
  // @Get()
  // async findAll(
  //   @Query() query: { query?: string; page?: 1; perPage?: 10 },
  // ) {
  //   const where = query.query
  //     ? {
  //         name: { contains: query.query },
  //       }
  //     : undefined;
  //   return this.endpointService.findAll({
  //     page: query.page,
  //     perPage: query.perPage,
  //     where,
  //   });
  // }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(EndpointDto) } } },
      ],
    },
  })
  @Put('/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateEndpointDto) {
    dto.id = id;
    return { data: await this.endpointService.update(dto) };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(EndpointDto) },
          },
        },
      ],
    },
  })
  @Delete('/:id')
  async delete(@Param('id') id: string) {
    return { data: await this.endpointService.delete(id) };
  }
}
