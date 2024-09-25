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
  ApiExtraModels,
  ApiOkResponse,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { RestApiResponse } from '../restapi/response.interface';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { EndpointDto } from './dto/endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { EndpointsService } from './endpoints.service';

@ApiTags('Endpoints')
@ApiSecurity('defaultBearerAuth')
@ApiExtraModels(EndpointDto)
@UseGuards(JwtGuard)
@Controller('endpoints')
export class EndpointsController {
  constructor(
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
  ) {}

  @Get('adaptors')
  listAdaptors(@Query('client') client?: boolean) {
    return this.endpointsService.list(client);
  }

  // @ApiOkResponse({ type: EndpointConfig })
  // @Get(':endpointType/config')
  // getConfig(@Param('endpointType') endpointType: EndpointType) {
  //   return this.endpointsService.getAdaptor(endpointType);
  //   if (!adaptor)
  //     throw new NotFoundException('No endpoint found with key:', endpointType);
  //   return adaptor.getConfig();
  // }

  @Post(':adaptorKey/create')
  async createEndpoint(
    @Req() req,
    @Param('adaptorKey') adaptorKey: string,
    @Body() dto: CreateEndpointDto,
  ) {
    return {
      data: await this.endpointsService.create({
        ...dto,
        adaptorKey,
        createdBy: req.user.sub,
      }),
    };
  }

  @Put(':id')
  async updateEndpoint(
    @Param('id') id: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return {
      data: await this.endpointsService.update(id, dto),
    };
  }

  /** for auth type `APP`, userKey is ignored */
  // @Put('auth')
  // async upsertEndpointAuth(@Req() req, @Body() dto: CreateEndpointAuthDto) {
  //   const endpoint = EntityIdExists.entity<EndpointDto>(dto, 'endpoint');
  //   return {
  //     data: await this.endpointsService.upsertEndpointAuth(
  //       { ...dto, createdBy: req.user.sub },
  //       endpoint,
  //     ),
  //   };
  // }

  @Post(':id/init')
  initEndpoint(@Param('id') id: string, @Body() initParams: object) {
    this.endpointsService.init(id, initParams);
  }

  /** manual test endpoint */
  @Post(':id/test')
  testEndpoint(@Param('id') id: string, @Body() any: any) {
    //
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
  async remove(@Param('id') id: string) {
    return { data: await this.endpointsService.delete(id) };
  }
}
