import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserViewSchema, type LoginInput, type UserView } from '@nexo/contracts';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class IdentityService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  async login(input: LoginInput): Promise<{ user: UserView; token: string }> {
    const found = await this.database.client.user.findUnique({ where: { email: input.email } });
    if (!found) throw new UnauthorizedException();
    const user = UserViewSchema.parse(found);
    const token = randomBytes(32).toString('hex');
    await this.database.client.session.create({ data: { tokenHash: this.hash(token), userId: user.id, expiresAt: new Date(Date.now() + 86400000) } });
    return { user, token };
  }
  async resolve(token: string): Promise<UserView | null> {
    if (!/^[0-9a-f]{64}$/.test(token)) return null;
    const session = await this.database.client.session.findUnique({ where: { tokenHash: this.hash(token) }, include: { user: true } });
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return UserViewSchema.parse(session.user);
  }
  async logout(token: string): Promise<void> {
    if (/^[0-9a-f]{64}$/.test(token)) await this.database.client.session.deleteMany({ where: { tokenHash: this.hash(token) } });
  }
  private hash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
}
