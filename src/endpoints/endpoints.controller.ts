import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { EndpointsService } from './endpoints.service';

@ApiTags('Endpoints')
@ApiSecurity('defaultBearerAuth')
@UseGuards(JwtGuard)
@Controller('endpoints')
export class EndpointsController {
  constructor(
    @Inject('EndpointsService')
    private readonly endpointsService: EndpointsService,
  ) {}

  @Get('adaptors')
  list(@Query('client') client?: boolean) {
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

  @Post(':adaptorKey/callgents')
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

  @Patch(':uuid')
  async updateEndpoint(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return {
      data: await this.endpointsService.update(uuid, dto),
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

  @Post(':uuid/init')
  initEndpoint(@Param('uuid') uuid: string, @Body() initParams: object) {
    this.endpointsService.init(uuid, initParams);
  }

  /** manual test endpoint */
  @Post(':uuid/test')
  testEndpoint(@Param('uuid') uuid: string, @Body() any: any) {
    //
  }
}
