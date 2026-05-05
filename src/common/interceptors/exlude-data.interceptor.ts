import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const EXCLUDED_KEYS = [
  'password',
  'verifyEmailToken',
  'resetPasswordToken',
  'resetPasswordExpires',
  'refreshToken',
  'deletedAt',
  'googleId',
  'facebookId',
];

@Injectable()
export class ExcludeDataInterceptor<T> implements NestInterceptor<T, T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    return next.handle().pipe(map((data) => this.deepFilter(data) as T));
  }

  private deepFilter(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map((item: unknown) => this.deepFilter(item));
    }

    if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
      const obj = data as Record<string, unknown>;
      const filteredObj: Record<string, unknown> = {};

      Object.keys(obj).forEach((key) => {
        if (EXCLUDED_KEYS.includes(key)) {
          return;
        }

        filteredObj[key] = this.deepFilter(obj[key]);
      });

      return filteredObj;
    }

    return data;
  }
}
