import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateEndpointAuthDto } from '../endpoint-auths/dto/create-endpoint-auth.dto';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { EntityIdExists } from '../infra/repo/validators/entity-exists.validator';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { EndpointDto } from './dto/endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';
import { EndpointConfig } from './endpoint.interface';
import { EndpointsService } from './endpoints.service';

@ApiTags('Endpoints')
@ApiBearerAuth('defaultBearerAuth')
@UseGuards(JwtGuard)
@Controller('endpoints')
export class EndpointsController {
  constructor(private readonly endpointsService: EndpointsService) {}

  @Get()
  list(@Query('receiver') receiver?: boolean) {
    return this.endpointsService.list(receiver);
  }

  @ApiOkResponse({ type: EndpointConfig })
  @Get(':endpointType/config')
  getConfig(@Param('endpointType') endpointType: string) {
    const service = this.endpointsService.getService(endpointType);
    if (!service)
      throw new NotFoundException('No endpoint found with key:', endpointType);
    return service.getConfig();
  }

  @Post(':endpointType/botlets')
  async createEndpoint(
    @Req() req,
    @Param('endpointType') endpointType: string,
    @Body() dto: CreateEndpointDto,
  ) {
    return {
      data: await this.endpointsService.create({
        ...dto,
        typeKey: endpointType,
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
  @Put('auth')
  async upsertEndpointAuth(@Req() req, @Body() dto: CreateEndpointAuthDto) {
    const endpoint = EntityIdExists.entity<EndpointDto>(dto, 'endpointUuid');
    return {
      data: await this.endpointsService.upsertEndpointAuth(
        { ...dto, createdBy: req.user.sub },
        endpoint,
      ),
    };
  }

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
