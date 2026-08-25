import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('FB_APP_ID'),
      clientSecret: config.getOrThrow<string>('FB_APP_SECRET'),
      callbackURL: config.getOrThrow<string>('FB_CALLBACK_URL'),
      scope: 'email',
      profileFields: ['emails', 'name', 'photos'],
    });
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile): any {
    const { name, emails, photos, id } = profile;

    return {
      facebookId: id,
      email: emails && emails.length > 0 ? emails[0].value : '',
      firstName: name?.givenName ?? '',
      lastName: name?.familyName ?? '',
      picture: photos && photos.length > 0 ? photos[0].value : '',
    };
  }
}
