import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JwtPayload } from '../infra/auth/jwt/jwt.service';
import { Utils } from '../infra/libs/utils';

/** TODO redis */
@Injectable()
export class AuthTokensService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  /**
   * @param payload { exp?: sec }
   * @returns token: payload.jti
   */
  @Transactional()
  async issue(payload: JwtPayload, type: 'JWT' | 'API_KEY') {
    const token = payload.jti || (payload.jti = Utils.uuid());
    const expiresAt = payload.exp
      ? new Date(Date.now() + payload.exp * 1000)
      : undefined;

    const prisma = this.txHost.tx as PrismaClient;
    await prisma.authToken.create({
      data: { token, type, payload, expiresAt },
    });
    return token;
  }

  /**
   * @param once whether remove from db
   */
  @Transactional()
  async verify(
    jtiToken: string,
    type: 'JWT' | 'API_KEY',
    once?: boolean,
  ): Promise<JwtPayload> {
    const prisma = this.txHost.tx as PrismaClient;
    const authToken = await prisma.authToken.findFirst({
      where: { token: jtiToken, type },
    });
    if (authToken) {
      const expired = authToken.expiresAt < new Date();
      if (once || expired)
        await prisma.authToken.delete({ where: { pk: authToken.pk } });
      if (!expired && !authToken.revoked)
        return authToken.payload as JwtPayload;
    }
  }

  @Transactional()
  async revoke(token: string, type: 'JWT' | 'API_KEY') {
    const prisma = this.txHost.tx as PrismaClient;
    if (type == 'JWT')
      return prisma.authToken.upsert({
        where: { token },
        update: { revoked: true },
        create: { token, type, payload: {}, revoked: true },
      });

    return prisma.authToken.delete({ where: { token } });
  }
}
