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
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CallgentDto } from '../callgents/dto/callgent.dto';
import { CreateCallgentDto } from '../callgents/dto/create-callgent.dto';
import { RestApiResponse } from '../restapi/response.interface';
import { CallgentHubService } from './callgent-hub.service';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';

@ApiTags('Hub')
@Controller('hub')
export class CallgentHubController {
  constructor(private readonly callgentHubService: CallgentHubService) {}

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
  @Get('callgents')
  async findAll(
    @Query()
    query: {
      queryString?: string;
      page?: 1;
      perPage?: 10;
      // TODO orderBy?: string;
    },
  ) {
    const where = query.queryString
      ? {
          name: { contains: query.queryString },
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

  @ApiOperation({ summary: 'Duplicate a callgent from Hub.' })
  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentDto) } } },
      ],
    },
  })
  @UseGuards(JwtGuard)
  @Post(':id/duplicate')
  async duplicateFromHub(
    @Param('id') id: string,
    @Req() req,
    @Body() dto: CreateCallgentDto,
  ) {
    return {
      data: await this.callgentHubService.duplicateFromHub(
        id,
        dto,
        req.user.sub,
      ),
    };
  }
}
