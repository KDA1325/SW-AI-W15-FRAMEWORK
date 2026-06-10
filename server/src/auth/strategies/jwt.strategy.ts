// Injectable은 NestJS가 이 클래스를 주입 가능한 서비스로 관리하게 해줍니다.
import { Injectable } from '@nestjs/common';

// ConfigService는 .env 파일에 있는 값을 읽을 때 사용합니다.
// 여기서는 JWT_SECRET 값을 읽기 위해 사용합니다.
import { ConfigService } from '@nestjs/config';

// PassportStrategy는 Passport 인증 전략을 NestJS에서 사용할 수 있게 해줍니다.
import { PassportStrategy } from '@nestjs/passport';

// ExtractJwt는 요청에서 JWT를 꺼내는 도구입니다.
// Strategy는 passport-jwt에서 제공하는 JWT 검증 전략입니다.
import { ExtractJwt, Strategy } from 'passport-jwt';

// Request 타입은 Express 요청 객체의 타입입니다.
import type { Request } from 'express';

// 브라우저 요청의 쿠키에서 access_token 값을 꺼내는 함수입니다.
// 로그인 성공 시 AuthService에서 access_token 쿠키에 JWT를 저장했습니다.
function fromCookie(req: Request): string | null {
  // req.cookies가 없을 수도 있으므로 ?. 를 사용해 안전하게 접근합니다.
  // ?. 는 Optional Chaining 문법입니다.
  // 앞의 값이 null 또는 undefined이면 에러를 내지 않고 undefined를 반환합니다.
  // 예: req가 없거나 req.cookies가 없어도 코드가 터지지 않습니다.
  // ?? 는 Nullish Coalescing 문법입니다.
  // 왼쪽 값이 null 또는 undefined이면 오른쪽 값인 null을 사용합니다.
  // access_token이 없으면 null을 반환합니다.
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.access_token;

  return typeof token === 'string' ? token : null;
}

// @Injectable()을 붙이면 NestJS가 JwtStrategy를 인증 전략으로 관리할 수 있습니다.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      // JWT를 어디에서 찾을지 정합니다.
      // 여기서는 Authorization 헤더가 아니라 쿠키의 access_token에서 찾습니다.
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie]),

      // JWT가 진짜인지 검증할 때 사용할 비밀키입니다.
      // AuthService에서 토큰을 만들 때 사용한 JWT_SECRET과 같은 값이어야 합니다.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // JWT 검증에 성공하면 validate 함수가 실행됩니다.
  // payload는 JWT 안에 들어 있던 데이터입니다.
  validate(payload: { sub: string; email: string }) {
    // 여기서 반환한 값은 컨트롤러의 req.user에 들어갑니다.
    // sub에는 사용자 id를 넣어두었기 때문에 userId로 이름을 바꿔서 반환합니다.
    return { userId: payload.sub, email: payload.email };
  }
}
