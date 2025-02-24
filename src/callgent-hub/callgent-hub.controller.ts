import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';
import { CallgentDto } from '../callgents/dto/callgent.dto';
import { CreateCallgentDto } from '../callgents/dto/create-callgent.dto';
import { JwtGuard } from '../infras/auth/jwt/jwt.guard';
import { EntityIdExists } from '../infras/repo/validators/entity-exists.validator';
import { RestApiResponse } from '../restapi/response.interface';
import { CallgentHubService } from './callgent-hub.service';

export class CreateCallgentDtoEx extends CreateCallgentDto {
  @ApiProperty({
    type: 'integer',
    format: 'int32',
    required: true,
    nullable: false,
  })
  @IsNotEmpty()
  @IsInt()
  @EntityIdExists('tag', 'pk')
  mainTagId: number;
}

@ApiTags('Hub')
@ApiSecurity('defaultBearerAuth')
@Controller('hub')
export class CallgentHubController {
  constructor(private readonly callgentHubService: CallgentHubService) {}

  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
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
  @Get('callgents')
  async findAll(
    @Query()
    query: {
      query?: string;
      page?: 1;
      perPage?: 10;
      // TODO orderBy?: string;
    },
  ) {
    const where = query.query
      ? {
          name: { contains: query.query },
        }
      : undefined;
    const list = await this.callgentHubService.findAllInHub({
      page: query.page,
      perPage: query.perPage,
      where,
      // orderBy,
    });
    list.data?.forEach((item: any) => (item.children = []));
    return list;
  }

  @ApiOperation({ summary: 'Fork a callgent from the Callgent Hub.' })
  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @UseGuards(JwtGuard)
  @Post('callgents/:id/fork')
  async forkFromHub(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: CreateCallgentDto,
  ) {
    return {
      data: await this.callgentHubService.forkFromHub(id, dto, req.user.sub),
    };
  }

  @ApiOperation({
    summary: 'Commit a callgent to the Callgent Hub.',
    description: 'Only original callgent can go into the hub;',
  })
  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @UseGuards(JwtGuard)
  @Post('callgents/:id/commit')
  async commitToHub(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: CreateCallgentDtoEx,
  ) {
    return {
      data: await this.callgentHubService.commitToHub(id, dto, req.user.sub),
    };
  }
}
