import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthTokensService } from '../auth-tokens/auth-tokens.service';
import { EmailsService } from '../emails/emails.service';
import { AuthLoginEvent } from '../infras/auth/events/auth-login.event';
import { AuthLoginedEvent } from '../infras/auth/events/auth-logined.event';
import { JwtPayload } from '../infras/auth/jwt/jwt-auth.service';
import { Utils } from '../infras/libs/utils';
import { selectHelper } from '../infras/repo/select.helper';
import { PrismaTenancyService } from '../infras/repo/tenancy/prisma-tenancy.service';
import { CreateUserIdentityDto } from '../user-identities/dto/create-user-identity.dto';
import { ValidationEmailVo } from './dto/validation-email.vo';

/** FIXME CreateUserEvent: init a callgent with sep for user */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
    private readonly tenancyService: PrismaTenancyService,
    private readonly emailsService: EmailsService,
    private readonly authTokensService: AuthTokensService,
    private readonly eventEmitter: EventEmitter2,
  ) {}
  protected readonly defSelect: Prisma.UserSelect = {
    pk: false,
    tenantPk: false,
    deletedAt: false,
  };

  /**
   * validate pwd
   * @returns valid user object or undefined
   * @throws UnauthorizedException
   */
  async login(email: string, password: string) {
    const ui = await this.$findUserIdentity(email, 'local', {
      noTenant: true,
    });

    let valid = !!ui?.credentials;
    valid = valid && (await Utils.hashCompare(password, ui.credentials));
    // Utils.hashSalted(password).then((s)=>console.log(s));

    if (valid) return ui.user;
    throw new UnauthorizedException();
  }

  /**
   *
   * @param uid
   * @param provider
   * @param prisma
   * @param options {noTenant: 'true: w/o tenant limitation', evenInvalid: 'true: return deleted or any tenant.statusCode'}
   */
  @Transactional()
  async $findUserIdentity(
    uid: string,
    provider: string,
    options?: {
      noTenant?: boolean;
      evenInvalid?: boolean;
    },
  ) {
    const prisma = this.txHost.tx as PrismaClient;
    if (options?.noTenant) await this.tenancyService.bypassTenancy(prisma);
    try {
      // find user identity
      const where = options?.evenInvalid
        ? { uid, provider, deletedAt: { gte: 0 } }
        : { uid, provider, user: { tenant: { statusCode: { gt: 0 } } } };
      const ui = await prisma.userIdentity.findFirst({
        where,
        include: { user: { include: { tenant: true } } },
      });
      return ui;
    } finally {
      if (options?.noTenant)
        await this.tenancyService.bypassTenancy(prisma, false);
    }
  }

  /** for CallgentRealm, there is at most 1 identity per user per realm */
  async $findFirstUserIdentity(userId: string, provider: string) {
    const prisma = this.txHost.tx as PrismaClient;
    await this.tenancyService.bypassTenancy(prisma);
    try {
      return prisma.userIdentity.findFirst({
        where: { userId, provider },
      });
    } finally {
      await this.tenancyService.bypassTenancy(prisma, false);
    }
  }

  /**
   * register a new user if identity not existing; return user if existing and valid;
   * Note: tenant ctx will be set
   * @param ui - { email?, uid, provider, name?, credentials }
   * @returns user. undefined if existing but pending
   * @throws ForbiddenException if any of userIdentity/user/tenant is softly deleted
   */
  @Transactional()
  async registerUserFromIdentity(
    ui: CreateUserIdentityDto & { email_verified?: boolean },
  ) {
    const [mailName, emailHost] = ui.email?.split('@') || [];
    ui.name || (ui.name = mailName) || (ui.name = `${ui.provider}@${ui.uid}`);

    const prisma = this.txHost.tx as PrismaClient;
    let uiInDb = await this.$findUserIdentity(ui.uid, ui.provider, {
      noTenant: true,
      evenInvalid: true,
    });

    // if exists, no creation
    if (uiInDb) {
      if (uiInDb.provider == 'local')
        await this.login(uiInDb.uid, ui.credentials);

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
            uiInDb.user?.tenant?.statusCode === 0 ? 'pending' : 'inactive'
          } status, please try again later.`,
        );
      }
      this.tenancyService.setTenantId(uiInDb.user.tenant.pk);
    } else {
      // register tenant from email host
      const tenant = await this.registerTenant(emailHost);

      if (tenant.deletedAt)
        throw new ForbiddenException(
          emailHost,
          'Sorry, current account has no access to our services',
        );
      if (!(tenant.statusCode > 0))
        throw new ForbiddenException(
          emailHost,
          `Sorry, current account is in ${
            tenant.statusCode == 0 ? 'pending' : 'inactive'
          } statusCode, please try again later.`,
        );

      // create user
      const user: Prisma.UserUncheckedCreateWithoutUserIdentityInput = {
        tenantPk: tenant.pk,
        id: Utils.uuid(),
        name: ui.name,
        avatar: ui.avatar,
        deletedAt: tenant.deletedAt,
      };

      // create user and identity
      this.tenancyService.setTenantId(tenant.pk);
      if (ui.provider === 'local' && ui.credentials)
        ui.credentials = await this.updateLocalPassword(ui.credentials);
      uiInDb = await prisma.userIdentity.create({
        include: { user: { include: { tenant: true } } },
        data: {
          ...ui,
          uid: ui.uid,
          provider: ui.provider,
          tenantPk: tenant.pk,
          userId: user.id,
          deletedAt: tenant.deletedAt,
          user: {
            create: user,
          },
        },
      });
    }

    if (uiInDb?.email_verified && !uiInDb?.user?.email)
      // update user.email
      await prisma.user.updateMany({
        data: { email: uiInDb.email },
        where: { id: uiInDb.userId, email: { not: null } },
      });

    return uiInDb;
  }

  /**
   * @returns new or existing tenant, even invalid
   */
  @Transactional()
  async registerTenant(emailHost: string) {
    emailHost || (emailHost = undefined);
    const prisma = this.txHost.tx as PrismaClient;

    let tenant =
      emailHost &&
      (await prisma.tenant.findFirst({
        where: { emailHost, deletedAt: { gte: 0 } },
      }));

    if (!tenant) {
      // create a tenant
      tenant = await prisma.tenant.create({
        data: {
          id: Utils.uuid(),
          emailHost,
          name: emailHost,
          type: 1,
          statusCode: 1, // active by default
        },
      });
    }
    this.tenancyService.setTenantId(tenant.pk);
    return tenant;
  }

  findOne(id: string) {
    const prisma = this.txHost.tx as PrismaClient;
    return selectHelper(this.defSelect, (select) =>
      prisma.user.findUnique({
        select,
        where: { id },
      }),
    );
  }

  /**
   * @param email
   * @param resetPwd
   * @param userId current user id, may null
   * @param create whether create account if not found
   */
  @Transactional()
  async sendValidationEmail(args: ValidationEmailVo, userId: string) {
    const { email, create } = args;
    const ui = await this.$findUserIdentity(email, 'local', {
      noTenant: true,
      evenInvalid: true,
    });

    if (ui) {
      if (this._accountDeactivated(ui))
        throw new BadRequestException(
          'Sorry, the user account is deactivated:' + email,
        );
      if (ui.email_verified && !args.resetPwd)
        throw new BadRequestException(email + ' is already verified');
      userId = undefined;
    } else if (!create)
      throw new BadRequestException(
        'Sorry, the email is not registered, ' + email,
      );

    // force reset password if no credentials
    const resetPwd = !ui?.credentials || args.resetPwd;

    // generate token
    const token = await this.authTokensService.issue(
      { sub: email, exp: 60 * 60 * 24, resetPwd, create, userId },
      'API_KEY',
    );
    // send email
    return this.emailsService.sendTemplateEmail(
      [{ email, name: ui?.name || email.split('@')[0] }],
      'validation-email',
      { token, resetPwd, create },
    );
  }

  /** tenant ctx will be set */
  @Transactional()
  async validateEmail(token: string, pwd?: string) {
    const payload = await this.authTokensService.verify(token, 'API_KEY', true);
    if (!payload) return;

    const { sub: email, resetPwd, create, userId } = payload;

    let ui = await this.$findUserIdentity(email, 'local', {
      noTenant: true,
      evenInvalid: true,
    });

    const prisma = this.txHost.tx as PrismaClient;

    if (ui) {
      if (this._accountDeactivated(ui))
        throw new BadRequestException(
          'Sorry, the user account is deactivated:' + email,
        );

      if (resetPwd) await this.updateLocalPassword(pwd, ui.pk);
      else if (ui.email_verified)
        throw new BadRequestException(email + ' is already verified');
      else {
        this.tenancyService.setTenantId(ui.user.tenant.pk);
        prisma.userIdentity.update({
          where: { pk: ui.pk },
          data: { email_verified: true },
        });
      }
    } else {
      if (!create)
        throw new BadRequestException(
          'Sorry, the user account does not exist: ' + email,
        );

      if (userId) {
        // FIXME associate to user
        throw new NotImplementedException('associate to user');
      } else {
        ui = await this.registerUserFromIdentity({
          uid: email,
          email,
          provider: 'local',
          credentials: pwd,
          email_verified: true,
        });
      }
    }
    // update user.email
    await prisma.user.updateMany({
      data: { email },
      where: { id: ui.userId, email: { not: null } },
    });

    // auto login
    const [user] = await this.eventEmitter.emitAsync(
      AuthLoginEvent.eventName,
      new AuthLoginEvent('bypass', ui.provider, pwd, ui.uid, ui.user),
    );
    await this.eventEmitter.emitAsync(
      AuthLoginedEvent.eventName,
      new AuthLoginedEvent(user),
    );
    return user as JwtPayload;
  }

  @Transactional()
  async updateLocalPassword(pwd: string, pk?: number) {
    // TODO check pwd complexity
    if (pwd && (typeof pwd !== 'string' || pwd?.length < 8))
      throw new BadRequestException('Password should be at least 8 characters');

    const credentials = pwd ? await Utils.hashSalted(pwd) : undefined;
    if (pk) {
      const prisma = this.txHost.tx as PrismaClient;
      await prisma.userIdentity.update({
        where: { pk },
        data: { credentials },
      });
    }
    return credentials;
  }

  private _accountDeactivated(ui: any) {
    return (
      ui.deletedAt ||
      ui.user.deletedAt ||
      ui.user.tenant.deletedAt ||
      ui.user.tenant.statusCode !== 1
    );
  }

  @Transactional()
  async $getTenant(userId: string) {
    if (!userId) return;

    const prisma = this.txHost.tx as PrismaClient;
    await this.tenancyService.bypassTenancy(prisma);
    const t = await prisma.user
      .findUnique({
        where: { id: userId },
        select: { tenant: true },
      })
      .then((u) => u?.tenant);
    await this.tenancyService.bypassTenancy(prisma, false);
    return t;
  }
}
