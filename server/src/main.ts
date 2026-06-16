// ValidationPipe는 DTO에 적어둔 유효성 검사 규칙을 실제로 적용합니다.
// DTO는 Data Transfer Object의 약자
// -> API 요청과 응답(클라이언트와 서버 사이에서 주고받는 데이터)의 데이터 구조를 정의하는 객체
// -> DTO는 보통 클라이언트가 보내는 데이터 타입을 정의하는 용도로 많이 씀 but, 서버 -> 클라 데이터 보낼 때도 DTO를 쓸 수 있음
// => DTO에 유효성 검사 규칙을 적어두면, ValidationPipe가 이를 읽어서 API 요청이 올 때마다 자동으로 검증
import { ValidationPipe } from '@nestjs/common';

// NestFactory는 NestJS 앱을 생성할 때 사용합니다.
import { NestFactory } from '@nestjs/core';
import { join } from 'node:path';

// cookieParser는 요청에 담긴 쿠키를 읽을 수 있게 해줍니다.
import cookieParser from 'cookie-parser';
import express from 'express';

// 앱의 최상위 모듈입니다.
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// NestJS 서버를 실행시키는 시작 함수
// async -> bootstrap 함수 안에서 await를 사용할 수 있게 해줌
// await NestFactory, await app => 시간이 걸리는 작업들
// ex) Nest 앱 생성, 모듈 로딩, Provider 등록, DB 설정 준비, 서버 포트 열기...
async function bootstrap() {
  // AppModule을 기준으로 NestJS 앱을 생성합니다.
  const app = await NestFactory.create(AppModule);

  // req.cookies로 쿠키를 읽을 수 있게 설정합니다.
  app.use(cookieParser());
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

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
  // NestJS에서 전역적으로 사용할 수 있는 파이프 = 특정 Controller나 특정 API에만 적용하는 것이 아닌,
  // 프로젝트의 모든 요청에 공통으로 적용되는 요청 처리 필터/검사기
  app.useGlobalPipes(
    // Pipe: NestJS에서 컨트롤러 메서드에 값이 들어가기 전에 중간에서 데이터를 처리하는 장치
    // ValidationPipe => DTO에 적어둔 유효성 검사 규칙을 실제로 적용하는 파이프
    // -> 앞으로 들어오는 모든 API 요청은 DTO 기준으로 검사하고 변환하라는 의미
    // 클라에서 로그인 요청 -> 바로 로그인 컨트롤러 X, 요청 body가 ValidationPipe를 통해 검사를 하고 DTO 규칙에 맞아서 통과하면 컨트롤러 메서드 실행
    new ValidationPipe({
      // DTO에 없는 값은 제거합니다.
      // -> 클라이언트에서 요청한 데이터 중 서버 DTO에서 허용한 필드만 요청 데이터로 인정하겠다는 의미
      // ex) 로그인 DTO: 이메일, 패스워드
      // -> 클라에서 DTO에 없는 룰 값을 추가해서 요청을 보냄 -> DTO에 없는 값 자동으로 제거하고 컨트롤러로 넘김
      // 화이트리스트 판단 값은 class-validator 데코레이터가 붙은 속성 기준 ex) @IsEmail or @IsString...
      // 만약 DTO에서 이메일에 @IsEmail을 안 붙였다면 email은 DTO에 있어도 검증 데코레이터가 없기 때문에 기준에서 빠질 수 있음
      // 만약 검사는 필요 없고, 허용만 하고 싶은 필드가 있다면 @Allow() 씀
      whitelist: true,

      // DTO에 없는 값이 들어오면 에러를 냅니다.
      // 위 예시처럼 DTO에 없는 값이 들어오면 제거하지 않고 바로 에러를 보냄
      // -> 요청 자체를 거절하는 것
      // forbidNonWhitelisted로 DTO에 없는 값 요청 자체를 거절한다면 whitelist를 쓰는 이유가 없지 않나?
      // -> forbidNonWhitelisted는 단독으로 동작하는 옵션이 아니라 whitelist 동작을 바꾸는 옵션이다
      // 혼자서 DTO에 없는 값을 검사할 수 없음
      // -> whitelist가 먼저 켜져야 DTO 기준으로 허용된 필드 목록을 만들고, 그걸 받아서 forbidNonWhitelisted가 허용 목록에 없는 값이 있으면 제거하지 말고 에러 내는 것
      // 그러니까 whitelist는 항상 있어야 하고, forbidNonWhitelisted가 없으면 DTO 자동으로 걸러서 요청 보내고, forbidNonWhitelisted가 있으면 요청 안 보내고 바로 에러를 냄
      forbidNonWhitelisted: true,

      // 요청 데이터를 DTO 타입으로 변환합니다.
      transform: true,
    }),
  );

  // ExceptionFilter는 Controller나 Service에서 throw 된 예외를 잡아 응답 JSON 모양을 정리합니다.
  // useGlobalFilters()는 특정 API 하나가 아니라 서버 전체에 필터를 적용하는 NestJS 메서드입니다.
  // ValidationPipe가 "잘못된 입력을 찾아서 예외를 던지는 역할"이라면,
  // HttpExceptionFilter는 "그 예외를 프론트가 읽기 쉬운 공통 응답으로 바꾸는 역할"입니다.
  app.useGlobalFilters(new HttpExceptionFilter());

  // 3000번 포트에서 서버를 실행합니다.
  await app.listen(3000);
}

// bootstrap 함수를 실행해야 서버가 시작됩니다.
void bootstrap();
