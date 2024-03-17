import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../infra/auth/jwt/jwt.guard';
import { EndpointConfig } from './endpoint.interface';
import { EndpointsService } from './endpoints.service';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { UpdateEndpointDto } from './dto/update-endpoint.dto';

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
  @Get(':endpointKey/config')
  getConfig(@Param('endpointKey') endpointKey: string) {
    const service = this.endpointsService.getService(endpointKey);
    if (!service)
      throw new NotFoundException('No endpoint found with key:', endpointKey);
    return service.getConfig();
  }

  @Post(':endpointKey/botlets/:botletUuid')
  createEndpoint(
    @Param('botletUuid') botletUuid: string,
    @Param('endpointKey') endpointKey: string,
    @Body() dto: CreateEndpointDto,
  ) {
    this.endpointsService.create(endpointKey, botletUuid, dto);
  }

  @Patch(':uuid')
  updateEndpoint(@Param('uuid') uuid: string, @Body() dto: UpdateEndpointDto) {
    this.endpointsService.update(uuid, dto);
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
