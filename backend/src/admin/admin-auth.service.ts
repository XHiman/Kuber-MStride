import {
  Injectable,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'mitra_admin_session';
const ADMIN_USERNAME = 'XHiman';
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;

interface AdminSession {
  sub: string;
  exp: number;
}

interface AttemptWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class AdminAuthService {
  private readonly attempts = new Map<string, AttemptWindow>();

  login(username: string, password: string, ipAddress: string): string {
    this.checkRateLimit(ipAddress);
    const configuredPassword = process.env.ADMIN_PASSWORD;
    const sessionSecret = process.env.ADMIN_SESSION_SECRET;
    if (!configuredPassword || !sessionSecret || sessionSecret.length < 32) {
      throw new ServiceUnavailableException('Admin authentication is not configured.');
    }

    const usernameMatches = this.constantTimeEqual(username, ADMIN_USERNAME);
    const passwordMatches = this.constantTimeEqual(password, configuredPassword);
    if (!usernameMatches || !passwordMatches) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    this.attempts.delete(ipAddress);
    const now = Math.floor(Date.now() / 1000);
    const payload = this.encode({ sub: ADMIN_USERNAME, exp: now + SESSION_LIFETIME_SECONDS });
    return `${payload}.${this.sign(payload, sessionSecret)}`;
  }

  verifyCookieHeader(cookieHeader: string | undefined): boolean {
    const token = cookieHeader
      ?.split(';')
      .map(part => part.trim())
      .find(part => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
      ?.slice(ADMIN_COOKIE_NAME.length + 1);
    if (!token) return false;

    const sessionSecret = process.env.ADMIN_SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) return false;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return false;

    const expectedSignature = this.sign(payload, sessionSecret);
    if (!this.constantTimeEqual(signature, expectedSignature)) return false;

    try {
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession;
      return session.sub === ADMIN_USERNAME && Number.isInteger(session.exp) && session.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  cookie(token: string, secure: boolean): string {
    return [
      `${ADMIN_COOKIE_NAME}=${token}`,
      'HttpOnly',
      `SameSite=${secure ? 'None' : 'Strict'}`,
      'Path=/adminX',
      `Max-Age=${SESSION_LIFETIME_SECONDS}`,
      ...(secure ? ['Secure'] : []),
    ].join('; ');
  }

  clearCookie(secure: boolean): string {
    return [
      `${ADMIN_COOKIE_NAME}=`,
      'HttpOnly',
      `SameSite=${secure ? 'None' : 'Strict'}`,
      'Path=/adminX',
      'Max-Age=0',
      ...(secure ? ['Secure'] : []),
    ].join('; ');
  }

  private checkRateLimit(ipAddress: string): void {
    const now = Date.now();
    const current = this.attempts.get(ipAddress);
    if (!current || current.resetAt <= now) {
      this.attempts.set(ipAddress, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return;
    }
    current.count += 1;
    if (current.count > 10) {
      throw new HttpException('Too many admin login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private encode(value: AdminSession): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
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
