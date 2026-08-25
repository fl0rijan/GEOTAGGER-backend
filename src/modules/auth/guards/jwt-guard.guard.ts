import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/is-optional.decorator';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const IsPublic = this.reflector.getAllAndOverride<boolean>('is-public', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (IsPublic) {
      return true;
    }

    const isOptional = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isOptional) {
      try {
        await super.canActivate(context);
      } catch {
        //empty
      }
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
