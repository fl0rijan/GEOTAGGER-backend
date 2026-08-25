import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface UserPayload {
  id: string;
  email: string;
  isAdmin: boolean;
}

export interface RequestWithUser extends Request {
  user: UserPayload;
}

export const GetUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    const user = request.user;

    if (data) {
      return user ? user[data] : undefined;
    }

    return user;
  },
);
