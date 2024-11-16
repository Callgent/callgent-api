import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
import { JwtGuard } from '../infras/auth/jwt/jwt.guard';
import { JwtPayload } from '../infras/auth/jwt/jwt.service';
import { RestApiResponse } from '../restapi/response.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, TaskDto)
@UseGuards(JwtGuard)
@Controller(':callgent/tasks')
export class TasksController {
  constructor(private readonly taskService: TasksService) {}

  @ApiCreatedResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(TaskDto) },
            meta: {
              properties: {
                syncResult: {
                  type: 'any',
                  description:
                    'if receiver invocation is synchronous, we get result immediately here',
                },
              },
            },
          },
        },
      ],
    },
  })
  @Post()
  async create(
    @Req() req,
    @Param('callgent') callgentId: string,
    @Body() dto: CreateTaskDto,
  ) {
    const user: JwtPayload = req.user;
    // const [task, syncResult] = await this.taskService.create({
    //   ...dto,
    //   callgentId,
    //   callerType: user.aud,
    //   // assignees are set when processing the task
    //   createdBy: user.sub,
    // });
    // return {
    //   data: task,
    //   meta: { syncResult },
    // };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(TaskDto) },
          },
        },
      ],
    },
  })
  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return { data: await this.taskService.findOne(id) };
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
            data: { type: 'array', items: { $ref: getSchemaPath(TaskDto) } },
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
          brief: { contains: query.queryString },
        }
      : undefined;
    return this.taskService.findAll({
      page: query.page,
      perPage: query.perPage,
      where,
    });
  }

  // @ApiOkResponse({
  //   schema: {
  //     allOf: [
  //       { $ref: getSchemaPath(RestApiResponse) },
  //       { properties: { data: { $ref: getSchemaPath(TaskDto) } } },
  //     ],
  //   },
  // })
  // @Put('/:id')
  // async update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
  //   dto.id = id;
  //   return { data: await this.taskService.update(dto) };
  // }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(TaskDto) },
          },
        },
      ],
    },
  })
  @Delete('/:id')
  async delete(@Param('id') id: string) {
    return { data: await this.taskService.delete(id) };
  }
}
