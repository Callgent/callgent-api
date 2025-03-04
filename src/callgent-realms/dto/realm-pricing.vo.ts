import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class RealmPricingVO {
  @ApiProperty({
    required: false,
    type: 'integer',
    format: 'int32',
    description:
      'Price per successful request, 1Billion=$0.01. `perResponse` is ignored if this is set',
  })
  @IsInt()
  @IsOptional()
  perRequest: number;

  @ApiProperty({
    required: false,
    description:
      'Function (response)=>int to calculate price per successful response, 1Billion=$0.01',
  })
  @IsString()
  @IsOptional()
  perResponse?: string;
}
