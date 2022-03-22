import { PermissionEnum } from './user/permission.enum';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { InterfaceNames } from './shared/enum/interface-names.enum';
import { CookieErrors, CookieNames } from './shared/enum/cookie.enums';

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    let hasAccess: boolean;
    const headerKey = 'x-121-interface';

    const endpointPermissions = this.reflector.get<PermissionEnum[]>(
      'permissions',
      context.getHandler(),
    );

    if (!endpointPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const originInterface = request.headers[headerKey];

    if (
      request.cookies &&
      ((originInterface === InterfaceNames.portal &&
        request.cookies[CookieNames.portal]) ||
        (originInterface === InterfaceNames.awApp &&
          request.cookies[CookieNames.awApp]) ||
        (originInterface === InterfaceNames.paApp &&
          request.cookies[CookieNames.paApp]) ||
        (!originInterface && request.cookies[CookieNames.general])) &&
      endpointPermissions
    ) {
      let token;
      switch (originInterface) {
        case InterfaceNames.portal:
          token = request.cookies[CookieNames.portal];
          break;
        case InterfaceNames.awApp:
          token = request.cookies[CookieNames.awApp];
          break;
        case InterfaceNames.paApp:
          token = request.cookies[CookieNames.paApp];
          break;

        default:
          token = request.cookies[CookieNames.general];
          break;
      }
      if (token) {
        const decoded: any = jwt.verify(
          token,
          process.env.SECRETS_121_SERVICE_SECRET,
        );
        if (decoded.permissions) {
          hasAccess = await this.aidworkerCanActivate(
            decoded.permissions,
            endpointPermissions,
          );
        }
      }
    } else {
      hasAccess = false;
    }
    if (hasAccess === false) {
      // Add this to stay consitent with the old auth middeleware which returns 401
      // If you remove this an unautherized request return 403 will be sent
      if (
        request.cookies[CookieNames.old] ||
        Object.keys(request.cookies).length === 0
      ) {
        throw new HttpException(CookieErrors.oldOrNo, HttpStatus.UNAUTHORIZED);
      } else {
        throw new HttpException('Not authorized.', HttpStatus.UNAUTHORIZED);
      }
    }
    return hasAccess;
  }

  private async aidworkerCanActivate(
    userPermissions: PermissionEnum[],
    endpointPermissions: PermissionEnum[],
  ): Promise<boolean> {
    const overlappingPermissions = userPermissions.filter(permission =>
      endpointPermissions.includes(permission),
    );
    return overlappingPermissions.length > 0;
  }
}
