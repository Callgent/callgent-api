import { Body, Controller, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CallgentApiText } from '../../endpoints/endpoints.controller';
import { EndpointsService } from '../../endpoints/endpoints.service';
import { EntryDto } from '../../entries/dto/entry.dto';
import { JwtGuard } from '../../infras/auth/jwt/jwt.guard';
import { EntityIdExists } from '../../infras/repo/validators/entity-exists.validator';
@ApiTags('BFF')
@ApiSecurity('defaultBearerAuth')
@UseGuards(JwtGuard)
@Controller('bff/endpoints')
export class BffEndpointsController {
  constructor(
    @Inject('EndpointsService')
    private readonly endpointService: EndpointsService,
  ) {}

  @ApiOperation({
    summary: 'Parse import text and create batch.',
    description: 'return { data: imported_functions_count } on success',
  })
  @Post('import')
  async importBatch(
    @Req() req,
    @Body()
    apiTxt: CallgentApiText,
  ) {
    const entry = EntityIdExists.entity<EntryDto>(apiTxt, 'entryId');
    await this.endpointService.importBatch(
      entry,
      apiTxt,
      req.user?.sub,
    );

    const data = await this.endpointService.findAll({
      where: { entryId: entry.id },
    });

    return { data };
  }
}
