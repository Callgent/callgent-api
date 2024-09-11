import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CallgentsService } from '../../callgents/callgents.service';
import { CallgentDto } from '../../callgents/dto/callgent.dto';
import { RestApiResponse } from '../../restapi/response.interface';

@ApiTags('Hub')
@Controller('hub')
export class CallgentHubController {
  constructor(private readonly callgentService: CallgentsService) {}

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
    const list = await this.callgentService.findAllInHub({
      page: query.page,
      perPage: query.perPage,
      where,
      // orderBy,
    });
    list.data?.forEach((item: any) => (item.children = []));
    return list;
  }
}
