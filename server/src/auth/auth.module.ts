// Module은 NestJS에서 관련 기능을 하나로 묶을 때 사용합니다.
import { Module } from '@nestjs/common'

// ConfigService는 .env 값을 읽을 때 사용합니다.
import { ConfigService } from '@nestjs/config'

// JwtModule은 JWT 토큰 생성/검증에 필요한 기능을 제공합니다.
import { JwtModule } from '@nestjs/jwt'

// PassportModule은 Passport 인증 전략을 NestJS에서 사용하게 해줍니다.
// Passport 인증 전략: JWT, Local, OAuth 등 다양한 인증 방식을 구현할 수 있는 라이브러리
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AiProfile } from './entities/aiProfile.entity'
import { ArchivePost } from '../posts/entities/archivePost.entity'
import { Comment } from '../posts/entities/comment.entity'
import { EmbeddingDocument } from './entities/embeddingDocument.entity'
import { Game } from './entities/game.entity'
import { Recommendation } from './entities/recommendation.entity'
import { User } from './entities/user.entity'
import { UserGame } from './entities/userGame.entity'
import { SteamService } from './steam.service'
import { JwtStrategy } from './strategies/jwt.strategy'

// JWT signOptions의 expiresIn 타입을 정확히 맞추기 위해 가져옵니다.
// expiresIn: JWT 토큰의 만료 시간을 설정하는 옵션 -> 문자열('1d', '12h', '30m' 등)이나 숫자(초 단위)로 지정할 수 있음
import type { SignOptions } from 'jsonwebtoken'

// AuthModule은 로그인/회원가입 관련 파일을 하나로 묶는 모듈입니다.
@Module({
  imports: [
    // AuthModule 안에서 User 엔티티를 사용할 수 있도록 등록합니다.
    // forFeature() => TypeORM이 이 모듈에서 특정 엔티티를 사용할 수 있게 해주는 메서드
    TypeOrmModule.forFeature([
      User,
      Game,
      UserGame,
      ArchivePost,
      Comment,
      AiProfile,
      Recommendation,
      EmbeddingDocument,
    ]),
    // JWT 인증 전략을 사용하기 위해 PassportModule을 등록합니다.
    PassportModule,

    // JWT 설정은 .env 값을 읽어와서 비동기로 등록합니다.
    // 비동기 등록인데 앞에 async 안 붙이는 이유 => JwtModule.registerAsync() 자체가 비동기 등록을 위한 메서드이기 때문
    JwtModule.registerAsync({
      inject: [ConfigService], // DI(의존성 주입) => ConfigService를 주입받아서 JWT 설정에 사용하겠다는 뜻
      useFactory: (config: ConfigService) => {
        // JWT_EXPIRES_IN은 .env에서 읽어온 문자열입니다.
        // SignOptions['expiresIn'] 타입으로 지정하면 JwtModule의 타입 오류를 줄일 수 있습니다.
        // JwtModule의 타입 오류 => JwtModule이 내부적으로 JWT 라이브러리를 사용하면서 JWT 라이브러리의 타입과 NestJS의 타입이 완전히 일치하지 않아서 발생하는 문제
        const expiresIn =
          config.get<SignOptions['expiresIn']>('JWT_EXPIRES_IN') ?? '1d'

        return {
          // JWT를 만들고 검증할 때 사용할 비밀키입니다.
          secret: config.getOrThrow<string>('JWT_SECRET'),

          // JWT 만료 시간입니다.
          signOptions: { expiresIn },
        }
      },
    }),
  ],

  // 이 모듈에서 사용할 컨트롤러입니다.
  controllers: [AuthController],

  // 이 모듈에서 사용할 서비스와 전략입니다.
  providers: [AuthService, JwtStrategy, SteamService],
})
export class AuthModule {}
