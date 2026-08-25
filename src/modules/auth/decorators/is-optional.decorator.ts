import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'is-optional-auth';
export const IsOptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
