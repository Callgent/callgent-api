import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { Utils } from '../infra/libs/utils';
import { selectHelper } from '../infra/repo/select.helper';
import { PrismaTenancyService } from '../infra/repo/tenancy/prisma-tenancy.service';
import { CreateUserIdentityDto } from '../user-identities/dto/create-user-identity.dto';

/** FIXME CreateUserEvent: init a botlet with sep for user */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tenancyService: PrismaTenancyService,
  ) {}
  protected readonly defSelect: Prisma.BotletSelect = {
    id: false,
    tenantId: false,
    createdBy: false,
    deletedAt: false,
  };

  /**
   * validate pwd
   * @returns valid user object or undefined
   */
  async login(email: string, password: string) {
    const prisma = this.txHost.tx as PrismaClient;

    const ui = await this.findUserIdentity(email, 'local', prisma, {
      noTenant: true,
    });

    let valid = !!ui?.credentials;
    valid = valid && (await Utils.hashCompare(password, ui.credentials));

    if (valid) return ui.user;
  }

  /**
   *
   * @param uid
   * @param provider
   * @param prisma
   * @param options {noTenant: 'true: w/o tenant limitation', evenInvalid: 'true: return deleted or any tenant.statusCode'}
   */
  async findUserIdentity(
    uid: string,
    provider: string,
    prisma: PrismaClient,
    options?: {
      noTenant?: boolean;
      evenInvalid?: boolean;
    },
  ) {
    if (options?.noTenant) await this.tenancyService.bypassTenancy(prisma);

    // find user identity
    const where = options?.evenInvalid
      ? {
          AND: {
            uid,
            provider,
            OR: [{ deletedAt: null }, { deletedAt: { not: null } }],
          },
        }
      : { AND: { uid, provider, user: { tenant: { statusCode: { gt: 0 } } } } };
    const ui = await prisma.userIdentity.findFirst({
      where,
      include: {
        user: { include: { tenant: true } },
      },
    });

    return ui;
  }

  /**
   * register a new user if identity not existing; return user if existing and valid;
   * @returns user. undefined if existing but pending
   * @throws ForbiddenException if any of userIdentity/user/tenant is softly deleted
   */
  @Transactional()
  async registerUserFromIdentity(ui: CreateUserIdentityDto) {
    const [mailName, mailHost] = ui.email?.split('@') || [];
    ui.name || (ui.name = mailName) || (ui.name = `${ui.provider}@${ui.uid}`);

    const prisma = this.txHost.tx as PrismaClient;
    let uiInDb = await this.findUserIdentity(ui.uid, ui.provider, prisma, {
      noTenant: true,
      evenInvalid: true,
    });

    // if exists, no creation
    if (uiInDb) {
      if (
        uiInDb.deletedAt ||
        uiInDb.user?.deletedAt ||
        uiInDb.user?.tenant?.deletedAt
      ) {
        this.logger.warn('account is deleted, %j', uiInDb);
        throw new ForbiddenException(
          'Sorry, current account has no access to our services',
        );
      }
      if (!(uiInDb.user?.tenant?.statusCode > 0)) {
        this.logger.warn('account is invalid, %j', uiInDb);
        throw new ForbiddenException(
          `Sorry, current account is in ${
            uiInDb.user?.tenant?.statusCode == 0 ? 'pending' : 'inactive'
          } statusCode, please try again later.`,
        );
      }

      return uiInDb.user;
    }

    // register tenant from mail host
    const tenant = await this.registerTenant(mailHost);

    // create user
    const user: Prisma.UserUncheckedCreateWithoutUserIdentityInput = {
      tenantId: tenant.id,
      uuid: Utils.uuid(),
      name: ui.name,
      avatar: ui.avatar,
      deletedAt: tenant.deletedAt,
    };

    // create user and identity
    if (ui.provider === 'local' && ui.credentials)
      ui.credentials = await Utils.hashSalted(ui.credentials);
    uiInDb = await prisma.userIdentity.create({
      include: { user: { include: { tenant: true } } },
      data: {
        ...ui,
        uid: ui.uid,
        provider: ui.provider,
        tenantId: tenant.id,
        userUuid: user.uuid,
        deletedAt: tenant.deletedAt,
        user: {
          create: user,
        },
      },
    });

    if (tenant.deletedAt)
      throw new ForbiddenException(
        mailHost,
        'Sorry, current account has no access to our services',
      );
    if (!(tenant.statusCode > 0))
      throw new ForbiddenException(
        mailHost,
        `Sorry, current account is in ${
          tenant.statusCode == 0 ? 'pending' : 'inactive'
        } statusCode, please try again later.`,
      );

    return uiInDb.user;
  }

  /**
   * @returns new or existing tenant, even invalid
   */
  @Transactional()
  async registerTenant(mailHost: string) {
    mailHost || (mailHost = undefined);
    const prisma = this.txHost.tx as PrismaClient;

    let tenant =
      mailHost &&
      (await prisma.tenant.findFirst({
        where: {
          AND: {
            mailHost,
            OR: [{ deletedAt: null }, { deletedAt: { not: null } }],
          },
        },
      }));

    if (!tenant) {
      // create a tenant
      tenant = await prisma.tenant.create({
        data: {
          uuid: Utils.uuid(),
          mailHost,
          name: mailHost,
          type: 1,
          statusCode: 1, // active by default
        },
      });
    }
    return tenant;
  }

  findOne(uuid: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.user.findUnique({
        select,
        where: { uuid },
      }),
    );
  }
}
