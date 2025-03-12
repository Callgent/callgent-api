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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard } from '../infras/auth/jwt/jwt.guard';
import { RestApiResponse } from '../restapi/response.interface';
import { CallgentRealmsService } from './callgent-realms.service';
import { CallgentRealmDto } from './dto/callgent-realm.dto';
import { CreateCallgentRealmDto } from './dto/create-callgent-realm.dto';
import { isAuthType } from './dto/realm-scheme.vo';
import { RealmSecurityItemForm } from './dto/realm-security.vo';
import { UpdateCallgentRealmDto } from './dto/update-callgent-realm.dto';

@ApiTags('CallgentRealms')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(RestApiResponse, CallgentRealmDto, RealmSecurityItemForm)
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
  @Get('/:id')
  async findOneRealm(@Param('id') id: string) {
    const data = await this.callgentRealmsService.findOne(id, {
      secret: true,
      pk: false,
    });
    data.secret = !!data.secret;
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
  async createRealm(@Body() dto: CreateCallgentRealmDto) {
    if (!isAuthType(dto.authType))
      throw new BadRequestException('Invalid authType');
    return {
      data: await this.callgentRealmsService.create(dto as any),
    };
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
  @Put(':id')
  async updateRealm(
    @Param('id') id: string,
    @Body() dto: UpdateCallgentRealmDto,
  ) {
    const data = await this.callgentRealmsService
      .update(id, dto, { secret: true, pk: false })
      .then((r) => r && { ...r, secret: !!r.secret });

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
  @Get('/callgent/:callgentId')
  async findAllRealms(@Param('callgentId') callgentId: string) {
    const data = await this.callgentRealmsService
      .findAll(callgentId, { select: { secret: true, pk: false } })
      .then((r) => r?.map((d) => ({ ...d, secret: !!d.secret })));
    return { data };
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
  @Delete(':id')
  async removeRealm(@Param('id') id: string) {
    return {
      data: await this.callgentRealmsService.delete(id),
    };
  }

  @ApiOperation({ summary: 'Update securities on entry/endpoint' })
  /// securities
  @ApiParam({ name: 'type', type: 'string', enum: ['entry', 'function'] })
  @ApiBody({ isArray: true, type: RealmSecurityItemForm })
  @Post('securities/:type/:id')
  async bindEntryOrEndpointSecurities(
    @Param('type') type: 'entry' | 'function',
    @Param('id') id: string,
    @Body() securities: RealmSecurityItemForm[], // TODO: RealmSecurityVO
    @Req() req,
  ) {
    const { sub: opBy } = req.user;
    return {
      data: await this.callgentRealmsService.updateSecurities(
        type,
        id,
        securities,
        opBy,
      ),
    };
  }
}
