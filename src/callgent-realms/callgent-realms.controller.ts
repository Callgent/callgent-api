import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
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
import { CallgentRealmsService } from './callgent-realms.service';
import { CallgentRealmDto } from './dto/callgent-realm.dto';
import { CreateCallgentRealmDto } from './dto/create-callgent-realm.dto';
import { isAuthType } from './dto/realm-scheme.vo';
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
              $ref: getSchemaPath(CallgentRealmDto) }}},
        {
          properties: {
            data: {
              properties: {
                secret: {
                  type: 'boolean',
                  description: 'secret is masked, true means set'}}}}}]}})
  @Get(':callgentId/:realmKey')
  async findOne(
    @Param('callgentId') callgentId: string,
    @Param('realmKey') realmKey: string,
  ) {
    // TODO realmKey may be in body
    const data = await this.callgentRealmsService
      .findOne(callgentId, realmKey)
      .then((r) => r && { ...r, secret: r.secret ? true : false });
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
        where: { callgentId },
      })
      .then((r) => r?.map((d) => ({ ...d, secret: d.secret ? true : false })));
    return { data };
  }

  @ApiOkResponse({
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentRealmDto) } } },
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
  @Put(':callgentId/:realmKey')
  async update(
    @Param('callgentId') callgentId: string,
    @Param('realmKey') realmKey: string,
    @Body() dto: UpdateCallgentRealmDto,
  ) {
    // TODO realmKey may be in body
    const data = await this.callgentRealmsService
      .update(callgentId, realmKey, dto, { pk: false })
      .then((r) => r && { ...r, secret: r.secret ? true : false });

    return { data };
  }

  @ApiCreatedResponse({
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        { properties: { data: { $ref: getSchemaPath(CallgentRealmDto) } } },
      ],
    },
  })
  @Post()
  async create(@Body() dto: CreateCallgentRealmDto) {
    if (!isAuthType(dto.authType))
      throw new BadRequestException('Invalid authType');
    return {
      data: await this.callgentRealmsService.create({
        ...dto,
        scheme: dto.scheme as any,
      }),
    };
  }

  @ApiOkResponse({
    schema: {
      anyOf: [
        { $ref: getSchemaPath(RestApiResponse) },
        {
          properties: {
            data: { $ref: getSchemaPath(CallgentRealmDto) },
          },
        },
      ],
    },
  })
  @Delete(':callgentId/:realmKey')
  async remove(
    @Param('callgentId') callgentId: string,
    @Param('realmKey') realmKey: string,
  ) {
    return {
      data: await this.callgentRealmsService.delete(callgentId, realmKey),
    };
  }
}
