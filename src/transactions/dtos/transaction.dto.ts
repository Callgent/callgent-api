import { Prisma } from '@prisma/client';
import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';

export class TransactionDto {
  @ApiResponseProperty({})
  id: string | null;

  @ApiResponseProperty({})
  txId: string | null;

  @ApiResponseProperty({})
  type: string;

  @ApiResponseProperty({})
  amount: Prisma.Decimal;

  @ApiResponseProperty({})
  currency: string;

  @ApiResponseProperty({})
  userId: string;

  @ApiResponseProperty({})
  createdAt: Date;

  @ApiResponseProperty({})
  updatedAt: Date;
}
