// Module은 NestJS에서 관련 기능을 하나로 묶을 때 사용합니다.
import { Module } from '@nestjs/common';

// ConfigService는 .env 값을 읽을 때 사용합니다.
import { ConfigService } from '@nestjs/config';

// JwtModule은 JWT 토큰 생성/검증에 필요한 기능을 제공합니다.
import { JwtModule } from '@nestjs/jwt';

// PassportModule은 Passport 인증 전략을 NestJS에서 사용하게 해줍니다.
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';

// JWT signOptions의 expiresIn 타입을 정확히 맞추기 위해 가져옵니다.
import type { SignOptions } from 'jsonwebtoken';

// AuthModule은 로그인/회원가입 관련 파일을 하나로 묶는 모듈입니다.
@Module({
  imports: [
    // AuthModule 안에서 User 엔티티를 사용할 수 있도록 등록합니다.
    TypeOrmModule.forFeature([User]),
    // JWT 인증 전략을 사용하기 위해 PassportModule을 등록합니다.
    PassportModule,

    // JWT 설정은 .env 값을 읽어와서 비동기로 등록합니다.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // JWT_EXPIRES_IN은 .env에서 읽어온 문자열입니다.
        // SignOptions['expiresIn'] 타입으로 지정하면 JwtModule의 타입 오류를 줄일 수 있습니다.
        const expiresIn =
          config.get<SignOptions['expiresIn']>('JWT_EXPIRES_IN') ?? '1d';

        return {
          // JWT를 만들고 검증할 때 사용할 비밀키입니다.
          secret: config.getOrThrow<string>('JWT_SECRET'),

          // JWT 만료 시간입니다.
          signOptions: { expiresIn },
        };
      },
    }),
  ],

  // 이 모듈에서 사용할 컨트롤러입니다.
  controllers: [AuthController],

  // 이 모듈에서 사용할 서비스와 전략입니다.
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
