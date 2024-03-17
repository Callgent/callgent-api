import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RestApiResponse<T> {
  @ApiPropertyOptional({
    description: 'Status code, empty means success',
  })
  statusCode?: number;

  @ApiPropertyOptional({ required: false, type: String })
  message?: string | string[];

  @ApiProperty()
  data: T;

  @ApiPropertyOptional({
    required: false,
    description:
      'Pagination, usage, quotation, profiling, versions, HATEOAS, etc.',
  })
  meta?: any;
}
