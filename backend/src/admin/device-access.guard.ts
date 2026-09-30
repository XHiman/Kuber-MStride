import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_DEVICE_ROUTES = new Set(['/users/device', '/users/claim']);
const READ_ONLY_ROUTE_PREFIXES = ['/bills', '/budget', '/transfers', '/districts', '/search'];

@Injectable()
export class DeviceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    if (request.method === 'OPTIONS') return true;
    const route = request.url.split('?')[0].replace(/\/+$/, '') || '/';
    if (route.startsWith('/adminX/api/') || PUBLIC_DEVICE_ROUTES.has(route)) return true;
    if (
      (request.method === 'GET' || request.method === 'HEAD')
      && (
        route === '/users'
        || READ_ONLY_ROUTE_PREFIXES.some(prefix => route === prefix || route.startsWith(`${prefix}/`))
      )
    ) {
      return true;
    }

    const deviceId = request.headers['x-device-id'];
    if (typeof deviceId !== 'string' || !deviceId) {
      throw new ForbiddenException('Register this browser device and wait for admin access.');
    }
    const device = await this.prisma.userDevice.findUnique({
      where: { deviceId },
      select: { accessEnabled: true, userId: true },
    });
    if (!device?.accessEnabled || !device.userId) {
      throw new ForbiddenException('Name this browser before making changes, or ask the site administrator to restore its access.');
    }
    return true;
  }
}
