import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { isAllowedAdminOrigin } from './admin-origin';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    if (
      !isAllowedAdminOrigin(request.headers.origin)
      || request.headers['x-admin-request'] !== '1'
    ) {
      throw new UnauthorizedException('Admin requests must come from the configured website.');
    }
    if (!this.auth.verifyCookieHeader(request.headers.cookie)) {
      throw new UnauthorizedException('Admin sign-in is required.');
    }
    return true;
  }
}
