import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const IsPublic = this.reflector.getAllAndOverride<boolean>('is-public', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (IsPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
