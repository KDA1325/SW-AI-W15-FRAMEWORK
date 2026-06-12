// NestJS가 .env 값을 읽어서 PostgreSQL 데이터베이스 연결
import { Module } from '@nestjs/common';
// ConfigModule과 TypeOrmModule을 함께 사용
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// AuthModule은 인증 관련 기능을 담당하는 모듈로, 이후에 구현될 예정
import { AuthModule } from './auth/auth.module';

// @Module 데코레이터 => NestJS에서 모듈을 정의하는 데 사용
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // 환경 변수(.env)로부터 데이터베이스 연결 정보를 주입받음
    // DI(의존성 주입)X -> 그냥 설정 주입(congiguration loading)
    // NestJS의 DI는 주로 Service나 Provider에서 사용 -> Service = new Service() 하는 게 아니라 NestJS가 필요한 객체를 대신 만들어서 주입하는 방식
    // -> boardRepository: BoardRepository
    // => NestJS 모듈에 전달해서 DB 연결 Provider를 만듦  
    // TypeOrmModule.forRootAsync() => AppModule이 TypeORM 설정 모듈을 가져와 사용하겠다는 뜻 
    // forRootAsync => DB 연결 설정을 비동기로 만들겠다는 뜻
    // Why 비동기? => configService 같은 다른 Provider를 주입받아서 설정값을 만들 수 있기 때문 -> DB 연결 설정이 다른 Provider에 의존할 수 있기 때문
    // configService => ConfigModule에서 제공하는 ConfigService는 .env 파일에서 설정값을 읽어서 제공하는 역할 -> DB 연결 설정을 .env 파일에서 읽어와서 TypeORM 설정에 사용
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService], // ConfigService를 inject => DI => 이 결과로 만들어진 DB 연결 객체들도 NestJS DI 컨테이너에 등록되어 이후 서비스에서 주입받아 사용 가능 
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // 이렇게 그냥 getter로 가져와서 DB 설정에 넣으면 DI X
        // but, host: configService.get<string>('DATABASE_HOST') 이렇게 하기도 함 -> 위에서 inject: [ConfigService] => ConfigService를 NestJS가 주입 = DI 
        // TypeORM 설정 객체를 만드는 과정임 
        // config.get -> 들어온 값이 없어도 바로 터지지 않고 undefined가 들어갈 수 있음 
        // config.getOrThrow -> .env에 값이 없을 때 서버 시작 시점에 바로 이 환경 변수가 없다고 알려줌 
        host: config.getOrThrow<string>('DATABASE_HOST'),
        //port: config.getOrThrow<number>('DATABASE_PORT'), -> 문자열 "5432"를 읽음 => <number> 형변환 X, number 형이라고 믿어달라고 하는 것
        port: Number(config.getOrThrow<string>('DATABASE_PORT')), // -> 문자열 5432를 숫자로 형변환 
        username: config.getOrThrow<string>('DATABASE_USER'),
        password: config.getOrThrow<string>('DATABASE_PASSWORD'),
        database: config.getOrThrow<string>('DATABASE_NAME'),
        // autoLoadEntities: true => TypeORM이 엔티티를 자동으로 로드하도록 설정 -> 엔티티는 DB 테이블과 매핑되는 클래스 => 이 설정이 없으면 엔티티를 명시적으로 등록해야 함
        autoLoadEntities: true,
        // synchronize: true => 애플리케이션이 실행될 때 데이터베이스 스키마를 엔티티 클래스에 맞게 자동으로 동기화하도록 설정 => 개발 환경에서는 편리하지만, 운영 환경에서는 데이터 손실 위험이 있으므로 주의해서 사용해야 함
        synchronize: true,
      }),
    }),
    AuthModule,
  ],
})
export class AppModule {}
