import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { RestApiResponse } from '../restapi/response.interface';
import { CallgentRealmsService } from './callgent-realms.service';
import { CallgentRealmDto } from './dto/callgent-realm.dto';
import { UpdateCallgentRealmDto } from './dto/update-callgent-realm.dto';

@ApiTags('CallgentRealms')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, CallgentRealmDto)
@UseGuards(JwtGuard)
@Controller('callgent-realms')
export class CallgentRealmsController {
  constructor(
    @Inject('CallgentRealmsService')
    private readonly callgentRealmsService: CallgentRealmsService,
  ) {}

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: {
              $ref: getSchemaPath(CallgentRealmDto),
            },
          },
        },
        {
          properties: {
            data: {
              properties: {
                secret: {
                  type: 'boolean',
                  description: 'secret is masked, true means set',
                },
              },
            },
          },
        },
      ],
    },
  })
  @Get(':callgentId/:realmKey')
  async findOne(
    @Param('callgentId') callgentId: string,
    @Param('realmKey') realmKey: string,
  ) {
    const data = await this.callgentRealmsService
      .findOne(callgentId, realmKey, { pk: false })
      .then((r) => ({ ...r, secret: r.secret ? true : false }));
    return { data };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(CallgentRealmDto) },
            },
          },
        },
        {
          properties: {
            data: {
              type: 'array',
              items: {
                properties: {
                  secret: {
                    type: 'boolean',
                    description: 'secret is masked, true means set',
                  },
                },
              },
            },
          },
        },
      ],
    },
  })
  @Get(':callgentId')
  async findAll(@Param('callgentId') callgentId: string) {
    const data = await this.callgentRealmsService
      .findAll({
        select: { pk: false },
        where: { callgentId },
      })
      .then((r) => r.map((d) => ({ ...d, secret: d.secret ? true : false })));
    return { data };
  }

  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentRealmDto) } } },
      ],
    },
  })
  @Put(':callgentId/:realmKey')
  async update(
    @Param('callgentId') callgentId: string,
    @Param('realmKey') realmKey: string,
    @Body() dto: UpdateCallgentRealmDto,
  ) {
    const data = await this.callgentRealmsService.update(
      callgentId,
      realmKey,
      dto,
      { pk: false },
    );
    return { data };
  }
}
