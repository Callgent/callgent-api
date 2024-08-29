import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CallgentApiText } from '../../callgent-functions/callgent-functions.controller';
import { CallgentFunctionsService } from '../../callgent-functions/callgent-functions.service';
import { EndpointDto } from '../../endpoints/dto/endpoint.dto';
import { JwtGuard } from '../../infra/auth/jwt/jwt.guard';
import { EntityIdExists } from '../../infra/repo/validators/entity-exists.validator';
import { EndpointType } from '@prisma/client';

@ApiTags('bff')
@UseGuards(JwtGuard)
@Controller('bff/callgent-functions')
export class BffCallgentFunctionsController {
  constructor(
    @Inject('CallgentFunctionsService')
    private readonly callgentFunctionService: CallgentFunctionsService,
  ) {}

  @Post('import')
  async importBatch(
    @Req() req,
    @Body()
    apiTxt: CallgentApiText,
  ) {
    const endpoint = EntityIdExists.entity<EndpointDto>(apiTxt, 'endpointId');
    await this.callgentFunctionService.importBatch(
      endpoint,
      apiTxt,
      req.user?.sub,
    );

    const data = await this.callgentFunctionService.findMany({
      where: { endpointId: endpoint.id },
    });

    return { data };
  }
}
