// NestJS에서 자주 쓰는 예외 클래스와 Injectable 데코레이터를 가져옵니다.
// ConflictException: 이미 가입된 이메일처럼 "충돌" 상황일 때 사용합니다.
// UnauthorizedException: 로그인 실패나 인증 실패일 때 사용합니다.
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

// JWT 토큰을 만들기 위한 NestJS 서비스입니다.
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// bcrypt는 비밀번호를 안전하게 암호화하고 비교하기 위한 라이브러리입니다.
import * as bcrypt from 'bcrypt';

// Express의 Response 타입입니다.
// 쿠키를 응답에 저장하거나 삭제할 때 사용합니다.
import { Response } from 'express';

// DB에서 가져온 사용자 객체의 타입으로 사용합니다.
import { User } from './entities/user.entity';

// 로그인 요청 데이터 타입입니다.
import { LoginDto } from './dto/login.dto';

// 회원가입 요청 데이터 타입입니다.
import { RegisterDto } from './dto/register.dto';

// @Injectable()을 붙이면 NestJS가 AuthService를 서비스로 관리합니다.
// 그래서 AuthController에서 constructor로 주입받아 사용할 수 있습니다.
@Injectable()
export class AuthService {
  constructor(
    // PrismaService 대신 DB 조회/저장에 사용할 TypeORM의 Repository를 주입받습니다.
    @InjectRepository(User)
    private userRepository: Repository<User>,

    // JWT 토큰 생성에 사용할 JwtService입니다.
    private jwt: JwtService,
  ) {}

  // 회원가입 로직입니다.
  async register(dto: RegisterDto, res: Response) {
    // 1. 사용자가 입력한 이메일이 이미 DB에 있는지 확인합니다.(이메일 중복 확인)
    // Prisma의 findUnique 대신 findOneBy 사용
    // findUnique는 Prisma가 제공하는 조회 함수입니다.
    // SQL로 치면 대략 아래와 비슷한 조회를 DB에 보내는 것입니다.
    // SELECT * FROM "User" WHERE email = dto.email LIMIT 1;
    // 단, findUnique는 @unique가 붙은 컬럼이나 id 같은 고유값으로만 조회할 때 사용합니다.
    const existingUser = await this.userRepository.findOneBy({
      email: dto.email,
    });

    // 2. 이미 같은 이메일이 있으면 회원가입을 막습니다.
    if (existingUser) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }

    // 3. 비밀번호 암호화
    // bcrypt.hash로 암호화된 비밀번호를 만듭니다.
    // 12는 salt rounds라고 부르는 암호화 강도입니다.
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // 4. 새 사용자 객체 생성 및 DB 저장 (create 후 save 진행)
    const newUser = this.userRepository.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    const user = await this.userRepository.save(newUser);

    // 5. 쿠키 설정 및 반환
    // 회원가입 성공 후 바로 로그인 상태로 만들기 위해 JWT 쿠키를 저장합니다.
    this.setCookie(res, user);

    // 6. passwordHash를 제외한 안전한 사용자 정보만 응답합니다.
    return this.safeUser(user);
  }

  // 로그인 로직
  async login(dto: LoginDto, res: Response) {
    // 1. 이메일로 사용자 조회
    // email은 schema.prisma에서 @unique로 설정했기 때문에 findUnique로 조회할 수 있습니다.
    // 사용자가 없으면 null이 반환됩니다.
    const user = await this.userRepository.findOneBy({ email: dto.email });

    // 2. 사용자가 없으면 로그인 실패입니다.
    if (!user) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 3. 사용자가 입력한 비밀번호와 DB에 저장된 암호화 비밀번호를 비교
    const isPasswordOk = await bcrypt.compare(dto.password, user.passwordHash);

    // 4. 비밀번호가 틀리면 로그인 실패입니다.
    if (!isPasswordOk) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    // 5. 로그인 성공 시 JWT 쿠키를 저장합니다.
    this.setCookie(res, user);

    // 6. 안전한 사용자 정보만 응답합니다.
    return this.safeUser(user);
  }

  // 현재 로그인한 사용자 정보를 가져오는 로직입니다.
  async me(userId: string) {
    // id 기본키로 사용자 조회
    // JwtStrategy에서 꺼낸 userId로 DB에서 사용자를 찾습니다.
    const user = await this.userRepository.findOneBy({ id: userId });

    // 사용자가 없으면 인증 실패로 처리합니다.
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.safeUser(user);
  }

  // 로그아웃 로직입니다.
  logout(res: Response) {
    // 브라우저에 저장된 access_token 쿠키를 삭제합니다.
    // 쿠키를 지울 때도 저장할 때와 같은 옵션을 맞춰주는 것이 안전합니다.
    res.clearCookie('access_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    return { ok: true };
  }

  // JWT를 만들고 브라우저 쿠키에 저장하는 private 메서드입니다.
  // private은 이 클래스 내부에서만 사용할 수 있다는 뜻입니다.
  private setCookie(res: Response, user: User) {
    // 로그인한 사용자를 증명할 JWT 토큰을 만드는 코드입니다.
    const token = this.jwt.sign({ sub: user.id, email: user.email });

    // access_token이라는 이름의 쿠키에 JWT를 저장합니다.
    res.cookie('access_token', token, {
      // JavaScript에서 쿠키를 직접 읽지 못하게 합니다.
      httpOnly: true,

      // 같은 사이트 또는 일반적인 이동 요청에서는 쿠키를 보냅니다.
      sameSite: 'lax',

      // 로컬 개발 환경은 http이므로 false입니다.
      // 실제 배포에서 https를 쓰면 true로 바꿉니다.
      secure: false,

      // 사이트 전체 경로에서 쿠키를 사용할 수 있게 합니다.
      path: '/',

      // 쿠키 유지 시간입니다. 24시간입니다.
      maxAge: 1000 * 60 * 60 * 24,
    });
  }

  // 프론트엔드로 보내도 되는 사용자 정보만 골라서 반환합니다.
  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
