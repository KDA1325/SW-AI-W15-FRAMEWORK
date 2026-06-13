import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// API 에러 응답의 공통 모양입니다.
// type은 TypeScript 문법으로, 실제 JavaScript 코드로 실행되지는 않고 컴파일 시점에만 타입 검사에 쓰입니다.
type ApiErrorResponse = {
  success: false;
  statusCode: number;
  message: string;
  errors: string[];
  path: string;
  timestamp: string;
};

// unknown은 "아직 타입을 모르는 값"이라는 뜻입니다.
// any처럼 아무렇게나 쓰지 못해서, 아래처럼 typeof로 확인한 뒤에만 안전하게 접근할 수 있습니다.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Nest ValidationPipe의 message는 보통 string[]이고,
// UnauthorizedException 같은 일반 예외의 message는 string으로 올 수 있어서 한 배열로 통일합니다.
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}

// HttpException.getResponse()는 string 또는 object를 반환할 수 있습니다.
// 이 함수는 그 여러 모양을 프론트가 읽기 쉬운 message/errors로 정리합니다.
function parseExceptionResponse(
  exceptionResponse: unknown,
  statusCode: number,
): Pick<ApiErrorResponse, 'message' | 'errors'> {
  if (typeof exceptionResponse === 'string') {
    return {
      message: exceptionResponse,
      errors: [exceptionResponse],
    };
  }

  if (isRecord(exceptionResponse)) {
    const messages = toStringArray(exceptionResponse.message);
    const fallbackMessage =
      typeof exceptionResponse.error === 'string'
        ? exceptionResponse.error
        : '요청을 처리할 수 없습니다.';

    return {
      // ValidationPipe처럼 여러 메시지가 오면 화면에서 한 번에 보여줄 수 있게 합칩니다.
      message: messages.length > 0 ? messages.join(' / ') : fallbackMessage,
      // errors는 상세 메시지 목록입니다. 프론트가 필요하면 배열 그대로 쓸 수 있습니다.
      errors: messages,
    };
  }

  const fallbackMessage =
    statusCode === HttpStatus.INTERNAL_SERVER_ERROR
      ? '서버 오류가 발생했습니다.'
      : '요청을 처리할 수 없습니다.';

  return {
    message: fallbackMessage,
    errors: [],
  };
}

// @Catch()는 이 클래스가 예외를 잡는 필터라는 뜻의 Nest 데코레이터입니다.
// 괄호 안에 특정 예외를 넣지 않으면 HttpException뿐 아니라 예상 못 한 에러까지 모두 받습니다.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  // catch는 ExceptionFilter 인터페이스가 요구하는 메서드입니다.
  // exception은 실제로 발생한 에러, host는 현재 HTTP 요청/응답 객체에 접근하는 Nest 래퍼입니다.
  catch(exception: unknown, host: ArgumentsHost) {
    // switchToHttp()는 Nest가 관리하는 실행 컨텍스트 중 HTTP 요청/응답 컨텍스트를 꺼내는 문법입니다.
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    // instanceof는 런타임에서 "이 값이 특정 클래스의 인스턴스인지" 확인하는 JavaScript 문법입니다.
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const parsedResponse = parseExceptionResponse(
      exceptionResponse,
      statusCode,
    );

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      message: parsedResponse.message,
      errors: parsedResponse.errors,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}
