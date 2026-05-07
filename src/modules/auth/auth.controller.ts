import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Get,
  Patch,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TokenResponse } from './dto/token-response.dto';
import express from 'express';
import { AuthGuard } from '@nestjs/passport';
import { IsPublic } from './decorators/is-public.decorator';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

interface GoogleUser {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  googleId: string;
}

interface FacebookUser {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  facebookId: string;
}

@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setRefreshCookie(res: express.Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
  }

  @IsPublic()
  @Post('signup')
  async register(@Body() createAuthDto: SignUpDto) {
    await this.authService.register(createAuthDto);

    return {
      data: null,
      message: 'Account created! Please check your email to verify.',
    };
  }

  @IsPublic()
  @ApiOkResponse({ type: TokenResponse })
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @UseGuards(AuthGuard('local'))
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('login')
  async login(
    @GetUser('id') userId: string,
    @GetUser('email') email: string,
    @GetUser('isAdmin') isAdmin: boolean,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const tokens = await this.authService.getTokens(userId, email, isAdmin);

    await this.authService.updateRefreshToken(userId, tokens.refreshToken);

    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
    };
  }

  @Post('logout')
  async logout(
    @GetUser('id') userId: string,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    res.clearCookie('refresh_token');
    await this.authService.logout(userId);

    return { data: null, message: 'Logged out' };
  }

  @Get('me')
  async getMe(@GetUser('id') userId: string) {
    return await this.authService.getProfile(userId);
  }

  @Patch('me/update-password')
  @ApiBody({ type: UpdatePasswordDto })
  async updatePassword(
    @GetUser('id') userId: string,
    @Body() dto: UpdatePasswordDto,
  ) {
    await this.authService.updatePassword(userId, dto);
    return { data: null, message: 'Password updated!' };
  }

  @IsPublic()
  @ApiOkResponse({ type: TokenResponse })
  @Post('refresh')
  async refresh(
    @Req() req: express.Request & { cookies: { refresh_token?: string } },
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException();

    const tokens = await this.authService.refreshTokens(refreshToken);

    this.setRefreshCookie(res, tokens.refreshToken);

    return { accessToken: tokens.accessToken };
  }

  @IsPublic()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email verification' })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);

    return { message: 'Email verified successfully!' };
  }

  @IsPublic()
  @Post('forgot-password')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);

    return {
      message:
        'If an account exists with that email, a reset link has been sent.',
    };
  }

  @IsPublic()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using the token from the email' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    await this.authService.resetPassword(dto);
    res.clearCookie('refresh_token');

    return {
      message: 'Password has been successfully reset. You can now log in.',
    };
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Resend the verification email' })
  async resend(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto);
  }

  @Get('google')
  @IsPublic()
  @UseGuards(AuthGuard('google'))
  async googleAuth(): Promise<void> {}

  @Get('google/callback')
  @IsPublic()
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<void> {
    const googleUser = req.user as GoogleUser;

    const user = await this.authService.validateOAuthUser(googleUser);

    const tokens = await this.authService.getTokens(
      user.id,
      user.email,
      user.isAdmin,
    );

    await this.authService.updateRefreshToken(user.id, tokens.refreshToken);

    this.setRefreshCookie(res, tokens.refreshToken);

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    return res.redirect(
      `${frontendUrl}/oauth-success?token=${tokens.accessToken}`,
    );
  }

  @Get('facebook')
  @IsPublic()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {}

  @Get('facebook/callback')
  @IsPublic()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ): Promise<void> {
    const fbUser = req.user as FacebookUser;

    const user = await this.authService.validateOAuthUser(fbUser);

    const tokens = await this.authService.getTokens(
      user.id,
      user.email,
      user.isAdmin,
    );

    await this.authService.updateRefreshToken(user.id, tokens.refreshToken);

    this.setRefreshCookie(res, tokens.refreshToken);

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    return res.redirect(
      `${frontendUrl}/oauth-success?token=${tokens.accessToken}`,
    );
  }
}
