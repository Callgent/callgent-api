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
   * @param payload { expiresIn?: sec }
   * @returns payload.jti
   */
  @Transactional()
  async issue(payload: JwtPayload, type: 'JWT' | 'API_KEY') {
    const token = payload.jti || (payload.jti = Utils.uuid());
    const expiresAt = payload.expiresIn
      ? new Date(Date.now() + payload.expiresIn * 1000)
      : undefined;

    const prisma = this.txHost.tx as PrismaClient;
    await prisma.authToken.create({
      data: { token, type, payload, expiresAt },
    });
    return token;
  }

  async verify(jtiToken: string, type: 'JWT' | 'API_KEY'): Promise<JwtPayload> {
    const prisma = this.txHost.tx as PrismaClient;
    const authToken = await prisma.authToken.findFirst({
      where: { token: jtiToken, type },
    });
    if (
      authToken &&
      !authToken?.revoked &&
      (!authToken.expiresAt || authToken.expiresAt > new Date())
    ) {
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
