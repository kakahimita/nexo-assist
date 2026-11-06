import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionModelKeyStore {
  private readonly keys = new Map<string, string>();

  create(key: string): string {
    const token = randomBytes(32).toString('hex');
    this.keys.set(token, key);
    return token;
  }

  claim(temporaryToken: string, sessionToken: string): void {
    const key = this.keys.get(temporaryToken);
    this.keys.delete(temporaryToken);
    if (key !== undefined) this.keys.set(sessionToken, key);
  }

  read(sessionToken: string): string | undefined {
    return this.keys.get(sessionToken);
  }

  clear(sessionToken: string): void {
    this.keys.delete(sessionToken);
  }
}
