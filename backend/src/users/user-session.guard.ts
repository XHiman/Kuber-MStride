import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserAuthService } from './user-auth.service';

@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(private readonly auth: UserAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      userId?: string;
    }>();
    const authorization = request.headers.authorization;
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    const userId = await this.auth.verifySession(token);
    if (!userId) throw new UnauthorizedException('Sign in to view your dashboard.');
    request.userId = userId;
    return true;
  }
}
