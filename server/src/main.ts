// ValidationPipe는 DTO에 적어둔 유효성 검사 규칙을 실제로 적용합니다.
import { ValidationPipe } from '@nestjs/common';

// NestFactory는 NestJS 앱을 생성할 때 사용합니다.
import { NestFactory } from '@nestjs/core';

// cookieParser는 요청에 담긴 쿠키를 읽을 수 있게 해줍니다.
import cookieParser from 'cookie-parser';

// 앱의 최상위 모듈입니다.
import { AppModule } from './app.module';

async function bootstrap() {
  // AppModule을 기준으로 NestJS 앱을 생성합니다.
  const app = await NestFactory.create(AppModule);

  // req.cookies로 쿠키를 읽을 수 있게 설정합니다.
  app.use(cookieParser());

  // React 개발 서버에서 NestJS API를 호출할 수 있게 허용합니다.
  app.enableCors({
    // 허용할 프론트엔드 주소입니다.
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',

    // 쿠키를 주고받으려면 true가 필요합니다.
    credentials: true,
  });

  // 모든 API 요청에 DTO 유효성 검사를 적용합니다.
  app.useGlobalPipes(
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
