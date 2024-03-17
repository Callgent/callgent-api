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

  @Transactional()
  async issue(payload: JwtPayload, type: 'JWT' | 'API_KEY') {
    const token = payload.jti || (payload.jti = Utils.uuid());

    const prisma = this.txHost.tx as PrismaClient;
    await prisma.authToken.create({ data: { token, type, payload } });
    return token;
  }

  async verify(token: string, type: 'JWT' | 'API_KEY'): Promise<JwtPayload> {
    const prisma = this.txHost.tx as PrismaClient;
    const authToken = await prisma.authToken.findFirst({
      where: { token, type },
    });
    return authToken?.payload as JwtPayload;
  }

  @Transactional()
  async revoke(token: string, type: 'JWT' | 'API_KEY'): Promise<void> {
    const prisma = this.txHost.tx as PrismaClient;
    prisma.authToken.upsert({
      where: { token },
      update: { revoked: true },
      create: { token, type, payload: {}, revoked: true },
    });
    return;
  }
}
