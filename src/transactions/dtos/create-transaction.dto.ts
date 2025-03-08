import { Prisma } from '@prisma/client';
import { IsDecimal, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiResponseProperty({})
  id?: string;

  @ApiProperty({
    description: 'transaction id from external system',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  txId: string;

  @ApiProperty({
    description: 'reference data from internal/external system',
    required: false,
    nullable: true,
  })
  @IsOptional()
  refData?: Prisma.InputJsonValue;

  @ApiProperty({
    description:
      'transaction type: 1: RECHARGE, 2: GIFT, 3. REFUND, 4: EXPENSE',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  type: 'RECHARGE' | 'GIFT' | 'REFUND' | 'EXPENSE';

  @ApiProperty({
    description: 'status 0: PENDING, 1: SUCCESS, -1: FAILED',
    type: 'integer',
    format: 'int32',
    required: false,
    default: 0,
  })
  status = 0;

  @ApiProperty({
    description: 'amount: 1billion = $0.01',
    type: 'number',
    format: 'double',
    required: true,
  })
  @IsNotEmpty()
  @IsDecimal()
  amount: Prisma.Decimal;

  @ApiProperty({
    description: 'currency: USD, CNY, ...',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  userId: string;
}
