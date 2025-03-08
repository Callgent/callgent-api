import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { paginator, PaginatorTypes } from '@nodeteam/nestjs-prisma-pagination';
import { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
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
    tenantPk_: false,
    deletedAt: false,
  };

  @Transactional()
  findByTx(txId: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return prisma.transaction.findUnique({ where: { txId } });
  }

  /**
   * commit and balance
   *
   * $.tx is empty if transaction is not committed
   * @returns  - { tx?, balance? }
   */
  @Transactional()
  async commit(txId: string, amount?: Decimal) {
    const prisma = this.txHost.tx as PrismaClient;
    const tx = await prisma.transaction.update({
      where: { txId, status: 0 },
      data: { status: 1, amount },
    });
    if (!tx) return {};
    this._checkAmount(tx);

    const tenant = await this._getTenant(tx.userId);
    const { balance } = await this.usersService.$balance(tenant.pk, tx.amount);
    return { tx, balance };
  }

  @Transactional()
  async rollback(txId: string) {
    const tx = await this.findByTx(txId);
    if (!tx) return;
    if (tx.status > 0)
      throw new NotImplementedException('if tx is active, do refunding');

    return this.txHost.tx.transaction.update({
      where: { txId },
      data: { status: -1 },
      select: this.defSelect,
    });
  }

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
    this._checkAmount(dto);

    const prisma = this.txHost.tx as PrismaClient;
    const tenantPk_ = tenant.pk;
    const [tx, balance] = await Promise.all([
      selectHelper(this.defSelect, (select) =>
        prisma.transaction.create({
          select,
          data: { ...dto, tenantPk_, id },
        }),
      ),
      this.usersService.$balance(tenantPk_, amount),
    ]);
    return { tx, balance };
  }

  /**
   * @throws BadRequestException if invalid
   */
  private _checkAmount(tx: { amount: Decimal; type: string }) {
    const { amount, type } = tx;
    if (
      (amount.gt(0) && (type === 'EXPENSE' || type === 'REFUND')) ||
      (amount.lt(0) && (type === 'RECHARGE' || type === 'GIFT'))
    )
      throw new BadRequestException('Invalid amount and type');
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
