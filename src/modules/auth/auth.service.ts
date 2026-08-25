import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SignUpDto } from './dto/sign-up.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';
import { User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { randomBytes } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

interface JwtPayload {
  sub: string;
  email: string;
  isAdmin: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async getTokens(userId: string, email: string, isAdmin: boolean) {
    const payload = { email, sub: userId, isAdmin };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '3d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    const hashedToken = refreshToken ? await this.hash(refreshToken) : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedToken },
    });
  }

  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token expired or invalid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshToken)
      throw new ForbiddenException('Access Denied');

    const matches = await this.deHash(refreshToken, user.refreshToken);
    if (!matches) throw new ForbiddenException('Access Denied');

    const tokens = await this.getTokens(user.id, user.email, user.isAdmin);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async register(signUpDto: SignUpDto) {
    const hashedPassword = await this.hash(signUpDto.password);

    try {
      const verificationToken = randomBytes(32).toString('hex');

      const user = await this.prisma.user.create({
        data: {
          ...signUpDto,
          password: hashedPassword,
          verifyEmailToken: verificationToken,
        },
      });

      this.mailService
        .sendVerificationEmail(user.email, user.firstName, verificationToken)
        .catch((err) => this.logger.error('Signup email failed', err));
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          if (err) {
            const field = err.message;

            if (field.includes('email')) {
              throw new BadRequestException('Email already exists');
            }
            if (field.includes('username')) {
              throw new BadRequestException('Username already exists');
            }
          }

          throw new BadRequestException(
            'A record with this unique value already exists.',
          );
        }
      }

      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async logout(userId: string) {
    return await this.updateRefreshToken(userId, null);
  }

  async getProfile(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is missing from request');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException("Didn't find anything");

    const {
      updatedAt: _updatedAt,
      deletedAt: _deletedAt,
      lastVerificationSentAt: _lastVerificationSentAt,
      ...safeUser
    } = user;

    return safeUser;
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto) {
    if (!userId) {
      throw new BadRequestException('User ID is missing from request');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException("Didn't find anything");

    if (user.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new one.',
        );
      }

      const isMatch = await this.deHash(dto.currentPassword, user.password);
      if (!isMatch) {
        throw new ForbiddenException('Current password is incorrect.');
      }
    }

    if (user.password && (await this.deHash(dto.newPassword, user.password))) {
      throw new BadRequestException(
        'New password cannot be the same as current password.',
      );
    }

    const hashedPassword = await this.hash(dto.newPassword);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        refreshToken: null,
      },
    });
  }

  async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async deHash(password: string, comparator: string): Promise<boolean> {
    return bcrypt.compare(password, comparator);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Partial<User> | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses Google/Facebook login. Please use social login instead.',
      );
    }

    if (user && (await this.deHash(password, user.password))) {
      const { password: _pw, ...result } = user;
      return result;
    }

    return null;
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { verifyEmailToken: token },
    });

    if (!user) throw new NotFoundException("Didn't find anything");

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verifyEmailToken: null,
      },
    });
  }

  async resendVerificationEmail(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return {
        message: 'Error finding user',
      };
    }

    if (user.verified) {
      throw new BadRequestException('This account is already verified.');
    }

    if (user.lastVerificationSentAt) {
      const COOLDOWN_MS = 60 * 1000 * 30;

      const lastSentDate = user.lastVerificationSentAt;

      const lastSentTime = lastSentDate.getTime();
      const now = new Date().getTime();

      if (now - lastSentTime < COOLDOWN_MS) {
        throw new HttpException(
          'Please wait 30 minutes before requesting another email.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const newToken = randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verifyEmailToken: newToken,
        lastVerificationSentAt: new Date(),
      },
    });

    await this.mailService.sendVerificationEmail(
      user.email,
      user.firstName,
      newToken,
    );

    return { message: 'A new verification email has been sent.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return {
        message:
          'If account with this email exists, a reset link has been sent.',
      };
    }

    const resetToken = randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpires: expiry,
      },
    });

    return this.mailService
      .sendPasswordResetEmail(user.email, user.firstName, resetToken)
      .catch((err) => this.logger.error(err));
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { resetPasswordToken: dto.token },
    });

    if (
      !user ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date()
    ) {
      throw new BadRequestException('Reset token is invalid or has expired.');
    }

    const hashedPassword = await this.hash(dto.newPassword);

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null,
      },
    });
  }

  async validateOAuthUser(profile: {
    email: string;
    firstName: string;
    lastName: string;
    googleId?: string;
    facebookId?: string;
    picture?: string;
  }) {
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      if (profile.googleId && !user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId },
        });
        this.logger.log(
          `Linked Google account to existing user: ${user.email}`,
        );
      }
      if (profile.facebookId && !user.facebookId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            facebookId: profile.facebookId,
            verified: true,
          },
        });
        this.logger.log(
          `Linked Facebook account to existing user: ${user.email}`,
        );
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          googleId: profile.googleId,
          facebookId: profile.facebookId,
          image: profile.picture,
          verified: true,
          gamePoints: 10,
          password: null,
        },
      });
    }

    return user;
  }
}
