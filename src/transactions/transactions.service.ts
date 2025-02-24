import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import { Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infras/libs/utils';
import { selectHelper } from '../infras/repo/select.helper';
import { UsersService } from '../users/users.service';
import { CreateTransactionDto } from './dtos/create-transaction.dto';

const paginate: PaginatorTypes.PaginateFunction = paginator({ perPage: 10 });

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly usersService: UsersService,
  ) {}
  protected readonly defSelect: Prisma.TransactionSelect = {
    pk: false,
    refData: false,
    tenantPk: false,
    deletedAt: false,
  };

  /** check tenant balance */
  async check(userId: string) {
    const tenant = await this._getTenant(userId);
    if (!tenant?.balance?.gt(0))
      throw new HttpException(
        'Insufficient balance',
        HttpStatus.PAYMENT_REQUIRED,
      );
    return tenant.balance;
  }

  /** create tx, and tenant balance */
  @Transactional()
  async create(dto: CreateTransactionDto) {
    const id = (dto.id = Utils.uuid());
    const tenant = await this._getTenant(dto.userId);

    // FIXME: currency exchange
    const amount = dto.amount;
    if (
      (amount.gt(0) && (dto.type === 'EXPENSE' || dto.type === 'REFUND')) ||
      (amount.lt(0) && (dto.type === 'RECHARGE' || dto.type === 'GIFT'))
    )
      throw new BadRequestException('Invalid amount and type');

    const prisma = this.txHost.tx as PrismaClient;
    const [tx, balance] = await Promise.all([
      selectHelper(this.defSelect, (select) =>
        prisma.transaction.create({
          select,
          data: { ...dto, tenantPk: tenant.pk, id },
        }),
      ),
      prisma.tenant.update({
        select: { balance: true },
        where: { pk: tenant.pk },
        data: { balance: { increment: amount } },
      }),
    ]);
    return { tx, balance };
  }

  @Transactional()
  private async _getTenant(userId: string) {
    const tenant = await this.usersService.$getTenant(userId);
    if (!tenant) throw new Error('Tenant not found for user ' + userId);
    return tenant;
  }

  async findMany({
    select,
    where,
    orderBy = [{ pk: 'desc' }],
    page,
    perPage,
  }: {
    select?: Prisma.TransactionSelect;
    where?: Prisma.TransactionWhereInput;
    orderBy?: Prisma.TransactionOrderByWithRelationInput[];
    page?: number;
    perPage?: number;
  }) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(
      select,
      async (select) => {
        const result = paginate(
          prisma.transaction,
          {
            select,
            where,
            orderBy,
          },
          {
            page,
            perPage,
          },
        );
        return result;
      },
      this.defSelect,
      'data',
    );
  }
}
