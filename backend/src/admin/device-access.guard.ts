import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_DEVICE_ROUTES = new Set(['/users/device', '/users/claim']);

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

    const deviceId = request.headers['x-device-id'];
    if (typeof deviceId !== 'string' || !deviceId) {
      throw new ForbiddenException('Register this browser device and wait for admin access.');
    }
    const device = await this.prisma.userDevice.findUnique({
      where: { deviceId },
      select: { accessEnabled: true },
    });
    if (!device?.accessEnabled) {
      throw new ForbiddenException('This browser device does not have access. Contact the site administrator.');
    }
    return true;
  }
}
