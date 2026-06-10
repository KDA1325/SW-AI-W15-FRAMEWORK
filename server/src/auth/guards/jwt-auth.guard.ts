// Injectable은 NestJS가 이 클래스를 관리할 수 있게 해주는 데코레이터입니다.
import { Injectable } from '@nestjs/common';

// AuthGuard는 Passport 인증 전략을 실행해주는 NestJS 도구입니다.
import { AuthGuard } from '@nestjs/passport';

// JwtAuthGuard는 로그인한 사용자만 API에 접근할 수 있게 막아주는 Guard입니다.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// extends AuthGuard('jwt')는 "jwt"라는 이름의 인증 전략을 사용하겠다는 뜻입니다.
// 여기서 "jwt"는 JwtStrategy에서 정한 이름입니다.
// 이 Guard를 @UseGuards(JwtAuthGuard)로 붙이면 요청이 컨트롤러 함수에 도착하기 전에 JWT 검사를 먼저 합니다.
