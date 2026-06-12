// ValidationPipe는 DTO에 적어둔 유효성 검사 규칙을 실제로 적용합니다.
// DTO는 Data Transfer Object의 약자 
// -> API 요청과 응답(클라이언트와 서버 사이에서 주고받는 데이터)의 데이터 구조를 정의하는 객체 
// -> DTO는 보통 클라이언트가 보내는 데이터 타입을 정의하는 용도로 많이 씀 but, 서버 -> 클라 데이터 보낼 때도 DTO를 쓸 수 있음
// => DTO에 유효성 검사 규칙을 적어두면, ValidationPipe가 이를 읽어서 API 요청이 올 때마다 자동으로 검증
import { ValidationPipe } from '@nestjs/common';

// NestFactory는 NestJS 앱을 생성할 때 사용합니다.
import { NestFactory } from '@nestjs/core';

// cookieParser는 요청에 담긴 쿠키를 읽을 수 있게 해줍니다.
import cookieParser from 'cookie-parser';

// 앱의 최상위 모듈입니다.
import { AppModule } from './app.module';

// NestJS 서버를 실행시키는 시작 함수 
// async -> bootstrap 함수 안에서 await를 사용할 수 있게 해줌
// await NestFactory, await app => 시간이 걸리는 작업들
// ex) Nest 앱 생성, 모듈 로딩, Provider 등록, DB 설정 준비, 서버 포트 열기... 
async function bootstrap() {
  // AppModule을 기준으로 NestJS 앱을 생성합니다.
  const app = await NestFactory.create(AppModule);

  // req.cookies로 쿠키를 읽을 수 있게 설정합니다.
  app.use(cookieParser());

  // React 개발 서버에서 NestJS API를 호출할 수 있게 허용합니다.
  // CORS(Cross-Origin Resource Sharing) 설정 => 다른 도메인에서 API를 호출할 수 있게 허용하는 설정
  // CORS: 브라우저가 다른 주소의 서버에 요청을 보낼 때 막을지 허용할지 정하는 보안 규칙 
  // 프론트 3000 -> 백 8080 
  // 프론트에서 백으로 요청 보냄 => CORS 문제 발생 => CORS 설정 필요
  // -> 백엔드에서 응답 헤더로 Access-Control-Allow-Origin: http://localhost:3000 이런 식으로 허용할 프론트엔드 주소를 명시적으로 적어줘야 함 => CORS 설정
  // => 이걸 해야 브라우저가 요청을 허용해줌
  // -> CORS는 백엔드끼리 통신할 때 생기는 문제 X -> 브라우저가 프론트엔드 요청을 검사하면서 생기는 문제  
  app.enableCors({
    // 허용할 프론트엔드 주소입니다.
    // origin -> 해당 주소에서 오는 요청만 허용한다는 뜻
    // process.env.CLIENT_URL => .env 파일에서 CLIENT_URL이라는 환경 변수를 읽어서 허용할 프론트엔드 주소로 사용하겠다는 뜻
    // ?? 'http://localhost:5173' => 만약 .env 파일에 CLIENT_URL이 없으면 기본값으로 http://localhost:5173을 사용하겠다는 뜻
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',

    // 쿠키를 주고받으려면 true가 필요합니다.
    // 요청을 보낼 때 쿠키/인증 정보도 같이 보낼 수 있게 함
    credentials: true,
  });

  // 모든 API 요청에 DTO 유효성 검사를 적용합니다.
  // useGlobalPipes() => NestJS에서 전역적으로 사용할 수 있는 파이프를 등록하는 메서드
  app.useGlobalPipes(
    // ValidationPipe => DTO에 적어둔 유효성 검사 규칙을 실제로 적용하는 파이프
    new ValidationPipe({
      // DTO에 없는 값은 제거합니다.
      whitelist: true,

      // DTO에 없는 값이 들어오면 에러를 냅니다.
      forbidNonWhitelisted: true,

      // 요청 데이터를 DTO 타입으로 변환합니다.
      transform: true,
    }),
  );

  // 3000번 포트에서 서버를 실행합니다.
  await app.listen(3000);
}

// bootstrap 함수를 실행해야 서버가 시작됩니다.
void bootstrap();
