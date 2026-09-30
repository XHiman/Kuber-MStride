import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite === 'cross-site') {
      throw new UnauthorizedException('Cross-site admin requests are not allowed.');
    }
    if (!this.auth.verifyCookieHeader(request.headers.cookie)) {
      throw new UnauthorizedException('Admin sign-in is required.');
    }
    return true;
  }
}
