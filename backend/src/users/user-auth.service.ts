import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const PASSWORD_HASH_BYTES = 64;

interface UserSession {
  sub: string;
  exp: number;
  iat: number;
}

interface AttemptWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class UserAuthService {
  private readonly attempts = new Map<string, AttemptWindow>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async login(username: string, password: string) {
    const normalizedUsername = username.trim().toLowerCase();
    this.checkRateLimit(normalizedUsername || '<empty>');
    const user = normalizedUsername
      ? await this.prisma.user.findUnique({ where: { username: normalizedUsername } })
      : null;
    if (!user?.passwordHash || !(await this.verifyPassword(password, user.passwordHash))) {
      this.recordFailedAttempt(normalizedUsername || '<empty>');
      throw new UnauthorizedException('Invalid username or password.');
    }
    this.attempts.delete(normalizedUsername);
    return {
      sessionToken: this.createSession(user.id),
      user: this.users.toProfile(user),
    };
  }

  async hashPassword(password: string): Promise<string> {
    if (typeof password !== 'string' || password.length < 10 || password.length > 256) {
      throw new BadRequestException('Passwords must be between 10 and 256 characters.');
    }
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, PASSWORD_HASH_BYTES) as Buffer;
    return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
  }

  async verifySession(token: string | undefined): Promise<string | null> {
    if (!token) return null;
    const secret = this.sessionSecret();
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return null;
    const expectedSignature = this.sign(payload, secret);
    if (!this.constantTimeEqual(signature, expectedSignature)) return null;
    let session: UserSession;
    try {
      session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as UserSession;
    } catch {
      return null;
    }
    if (
      typeof session.sub !== 'string' ||
      !Number.isInteger(session.exp) ||
      !Number.isInteger(session.iat) ||
      session.exp <= Date.now() / 1000
    ) {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, passwordHash: true, updatedAt: true },
    });
    return user?.passwordHash && user.updatedAt.getTime() <= session.iat ? user.id : null;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, saltValue, hashValue, extra] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !saltValue || !hashValue || extra !== undefined) return false;
    try {
      const salt = Buffer.from(saltValue, 'base64url');
      const expectedHash = Buffer.from(hashValue, 'base64url');
      if (expectedHash.length !== PASSWORD_HASH_BYTES) return false;
      const actualHash = await scrypt(password, salt, expectedHash.length) as Buffer;
      return timingSafeEqual(actualHash, expectedHash);
    } catch {
      return false;
    }
  }

  private createSession(userId: string): string {
    const issuedAt = Date.now();
    const payload = Buffer.from(JSON.stringify({
      sub: userId,
      exp: Math.floor(issuedAt / 1000) + SESSION_LIFETIME_SECONDS,
      iat: issuedAt,
    })).toString('base64url');
    return `${payload}.${this.sign(payload, this.sessionSecret())}`;
  }

  private checkRateLimit(username: string): void {
    const current = this.attempts.get(username);
    if (current && current.resetAt > Date.now() && current.count >= 10) {
      throw new HttpException('Too many sign-in attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private recordFailedAttempt(username: string): void {
    const now = Date.now();
    const current = this.attempts.get(username);
    if (!current || current.resetAt <= now) {
      this.attempts.set(username, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return;
    }
    current.count += 1;
  }

  private sessionSecret(): string {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('User authentication is not configured.');
    }
    return secret;
  }

  private sign(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64url');
  }

  private constantTimeEqual(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left);
    const rightBytes = Buffer.from(right);
    return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
  }
}
