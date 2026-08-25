import { RequestWithUser } from '../decorators/get-user.decorator';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.isAdmin) {
      throw new ForbiddenException(
        'Only administrators can perform this action.',
      );
    }

    return true;
  }
}
