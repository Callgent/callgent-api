import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import {
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
import { EventStoreDto } from './dto/event-store.dto';
import { EventStoresService } from './event-stores.service';

@Controller('events')
@ApiTags('Events')
@ApiSecurity('defaultBearerAuth')
@UseGuards(JwtGuard)
@Controller('entries')
export class EventStoresController {
  constructor(
    @Inject('EventStoresService')
    private readonly eventStoresService: EventStoresService,
  ) {}

  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'dataType', required: false, type: String })
  @ApiQuery({ name: 'taskId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  @ApiQuery({
    name: 'orderBy',
    description:
      'e.g. createdAt:desc,price:asc. Allowed fields: title, eventType, dataType, taskId, pk, updatedAt',
    required: false,
    type: Number,
  })
  @ApiOkResponse({
    description: 'List of my tasks',
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(EventStoreDto) },
            },
          },
        },
      ],
    },
  })
  @Get('tasks')
  listMyTasks(
    @Query()
    {
      query: title,
      eventType,
      dataType,
      taskId,
      page,
      perPage,
      orderBy: orders,
    }: {
      query?: string;
      eventType?: string;
      dataType?: string;
      taskId?: string;
      page?: 1;
      perPage?: 10;
      orderBy?: string;
    },
    @Req() req,
  ) {
    const calledBy = req.user.sub;
    const where: Prisma.EventStoreWhereInput = {
      calledBy,
      eventType: eventType || undefined,
      dataType: dataType || undefined,
      taskId: taskId || undefined,
    };
    title = title?.trim();
    title && (where.title = { contains: title });
    const orderBy: Prisma.EventStoreOrderByWithRelationInput[] =
      Utils.parseOrderBy(orders, [
        'title',
        'dataType',
        'eventType',
        'statusCode',
        'pk',
        'updatedAt',
      ]);
    return this.eventStoresService.findManyTasks({
      where,
      page,
      perPage,
      orderBy,
    });
  }
}
