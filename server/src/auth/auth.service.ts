// NestJS에서 자주 쓰는 예외 클래스와 Injectable 데코레이터를 가져옵니다.
// ConflictException: 이미 가입된 이메일처럼 "충돌" 상황일 때 사용합니다.
// UnauthorizedException: 로그인 실패나 인증 실패일 때 사용합니다.

// import에 하나씩 넣는 것과 ,로 여러 개 한 번에 넣는 것 차이 -> 그냥 취향 차이, 둘 다 가능
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

// JWT 토큰을 만들기 위한 NestJS 서비스입니다.
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
//'@nestjs/typeorm'과 typeorm 차이 -> '@nestjs/typeorm'은 NestJS에서 TypeORM을 사용할 때 필요한 모듈과 데코레이터를 제공하는 패키지
// 반면, 'typeorm'은 TypeORM 자체 라이브러리로, 데이터베이스와 상호작용하는 기능을 제공
// NestJS에서는 '@nestjs/typeorm'을 통해 TypeORM의 Repository를 주입받아 사용할 수 있음
// 그럼 '@nestjs/typeorm'는 typeorm의 래퍼? -> '@nestjs/typeorm'는 NestJS에서 TypeORM을 더 쉽게 사용할 수 있도록 도와주는 패키지
// '@nestjs/typeorm'을 통해 TypeORM의 Repository를 주입받아 사용할 수 있는데 typeorm을 또 가져오는 이유 -> Repository 타입을 사용하기 위해서
// 왜? import { Repository } from '@nestjs/typeorm';하면 안 됨?
// -> '@nestjs/typeorm'에서 Repository 타입을 가져오는 것도 가능하지만, 공식 문서에서는 TypeORM의 Repository 타입을 직접 가져와서 사용하는 것을 권장하기 때문에 typeorm에서 Repository를 가져오는 것이 일반적
import { Repository } from 'typeorm'

// bcrypt는 비밀번호를 안전하게 암호화하고 비교하기 위한 라이브러리입니다.
import * as bcrypt from 'bcrypt'

// Express의 Response 타입입니다.
// 쿠키를 응답에 저장하거나 삭제할 때 사용합니다.
import { Response } from 'express'

// DB에서 가져온 사용자 객체의 타입으로 사용합니다.
import { User } from './entities/user.entity'

// 로그인 요청 데이터 타입입니다.
// dto에서 요청 데이터 타입은 가져오는데 응답 데이터 타입은 안 가져오는 이유
// -> 응답 데이터는 보통 DB에서 가져온 엔티티 객체에서 필요한 정보만 골라서 반환하기 때문에, DTO로 따로 정의하지 않는 경우가 많습니다.
import { LoginDto } from './dto/login.dto'

// 회원가입 요청 데이터 타입입니다.
import { RegisterDto } from './dto/register.dto'

// @Injectable()을 붙이면 NestJS가 AuthService를 서비스로 관리합니다.
// 안 붙이면? -> NestJS가 이 클래스를 인식하지 못해서 DI(의존성 주입)도 안 되고, 다른 서비스나 컨트롤러에서 주입받아 사용할 수도 없음
// 그래서 AuthController에서 constructor로 주입받아 사용할 수 있습니다.
// constructor = 이 클래스가 만들어질 때 필요한 의존성들을 매개변수로 받는 함수 -> NestJS가 이 매개변수들을 보고 필요한 객체를 만들어서 주입해줌
@Injectable()
export class AuthService {
  constructor(
    // PrismaService 대신 DB 조회/저장에 사용할 TypeORM의 Repository를 주입받습니다.
    @InjectRepository(User)
    // 이게 싱글톤 -> NestJS가 애플리케이션 전체에서 하나의 Repository 객체를 만들어서 주입해준다는 뜻
    // 그러니까 큰 Repository 객체 하나 만들어서 이 AuthService뿐만 아니라 다른 서비스에서도 주입받아서 사용할 수 있다는 뜻
    // Repository 안에 userRepository, ARepository, BRepository 이런 식으로 한 개의 엔티티만 관리하는 Repository 객체 여러 개를 만들어서 주입한다는 뜻
    private userRepository: Repository<User>,

    // JWT 토큰 생성에 사용할 JwtService입니다.
    private jwt: JwtService,
  ) {}

  // 회원가입 로직입니다.
  async register(dto: RegisterDto, res: Response) {
    // 1. 사용자가 입력한 이메일이 이미 DB에 있는지 확인합니다.(이메일 중복 확인)
    // Prisma의 findUnique 대신 findOneBy 사용
    // findOneBy는 TypeORM이 제공하는 조회 함수입니다.
    // findOneBy는 where 조건으로 객체를 받습니다.
    // { email: dto.email } => email 컬럼이 dto.email과 일치하는 레코드를 찾겠다는 뜻
    // findUnique는 Prisma가 제공하는 조회 함수입니다.
    // SQL로 치면 대략 아래와 비슷한 조회를 DB에 보내는 것입니다.
    // SELECT * FROM "User" WHERE email = dto.email LIMIT 1;
    // 단, findUnique는 @unique가 붙은 컬럼이나 id 같은 고유값으로만 조회할 때 사용합니다.

    // this.userRepository.findOneBy -> 시간이 걸리는 작업 => await 필요
    const existingUser = await this.userRepository.findOneBy({
      // email 컬럼이 dto.email과 일치하는 레코드를 찾음
      // 레코드 = DB 테이블의 한 줄, 객체 하나라고 생각하면 됨
      email: dto.email,
    })

    // 2. 이미 같은 이메일이 있으면 회원가입을 막습니다.
    // existingUser는 true, false가 아니라 User 객체이거나 null
    // if(existingUser) => existingUser가 null이 아니면(이미 같은 이메일이 있으면) 회원가입을 막는다
    if (existingUser) {
      throw new ConflictException('이미 가입된 이메일입니다.')
    }

    // 3. 비밀번호 암호화
    // bcrypt.hash로 암호화된 비밀번호를 만듭니다.
    // 12는 salt rounds라고 부르는 암호화 강도입니다.
    // 암호화 하는 이유 => DB에 비밀번호를 평문으로 저장하면 보안에 매우 취약하기 때문
    // 해커가 DB를 탈취하더라도 암호화된 비밀번호는 원래 비밀번호를 알아내기 어렵게 만들어줍니다.
    const passwordHash = await bcrypt.hash(dto.password, 12)

    // 4. 새 사용자 객체 생성 및 DB 저장 (create 후 save 진행)
    const newUser = this.userRepository.create({
      email: dto.email,
      nickname: dto.nickname,
      passwordHash,
    })

    // save()는 DB에 저장하는 메서드 -> 저장된 객체를 반환
    const user = await this.userRepository.save(newUser)

    // 5. 쿠키 설정 및 반환
    // 회원가입 성공 후 바로 로그인 상태로 만들기 위해 JWT 쿠키를 저장합니다.
    // 쿠키는 캐시 데이터 아닌가 => 쿠키는 클라이언트(브라우저)에 저장되는 작은 데이터 조각
    // 서버가 클라이언트에게 보내는 응답에 Set-Cookie 헤더를 포함시켜서 쿠키를 설정
    // 이후 클라이언트는 해당 쿠키를 저장하고, 같은 도메인으로 요청을 보낼 때마다 자동으로 쿠키를 포함시켜서 서버로 보냄
    // 쿠키는 세션 관리, 사용자 인증, 사용자 선호도 저장 등 다양한 용도로 사용
    // 따라서 쿠키는 캐시 데이터와는 다르며, 주로 상태 유지와 인증에 사용됨
    this.setCookie(res, user)

    // 6. passwordHash를 제외한 안전한 사용자 정보만 응답합니다.
    // 쿠키도 응답? -> 쿠키는 응답 헤더에 Set-Cookie로 포함되어서 클라이언트로 전달됨
    // 서버에서 클라이언트로 사용자 정보를 왜 응답?
    // -> 회원가입이나 로그인 후에 클라이언트가 사용자 정보를 화면에 표시하거나, 애플리케이션 상태를 업데이트할 때 필요하기 때문
    return this.safeUser(user)
  }

  // 로그인 로직
  async login(dto: LoginDto, res: Response) {
    // 1. 이메일로 사용자 조회
    // email은 schema.prisma에서 @unique로 설정했기 때문에 findUnique로 조회할 수 있습니다.
    // 사용자가 없으면 null이 반환됩니다.
    const user = await this.userRepository.findOneBy({ email: dto.email })

    // 2. 사용자가 없으면 로그인 실패입니다.
    if (!user) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      )
    }

    // 3. 사용자가 입력한 비밀번호와 DB에 저장된 암호화 비밀번호를 비교
    // 그럼 결국 웹서비스는 사용자의 완벽한 비밀번호를 모르고 암호화된 것만 알아서 방금 입력으로 암호화된 것과 DB에 저장된 암호화 되어있는 것을 비교해서 같으면 로그인이 되는 건가
    // -> 맞음 웹서비스는 사용자의 완벽한 비밀번호를 알지 못하고, 대신 사용자가 입력한 비밀번호를 암호화하여 DB에 저장된 암호화된 비밀번호와 비교
    // bcrypt.compare() 함수는 이 과정을 처리하여, 입력된 비밀번호를 암호화된 형태로 변환한 후 DB에 저장된 암호화된 비밀번호와 비교하여 일치 여부를 반환
    // 따라서 사용자가 올바른 비밀번호를 입력하면 로그인에 성공
    // 난 맞게 잘 입력했는데 bcrypt가 고장나서 로그인 못할 수도 있나 -> bcrypt 라이브러리가 제대로 설치되고 작동한다면 그런 일은 거의 없지만, 만약 bcrypt에 문제가 생긴다면 로그인 과정에서 오류가 발생할 수 있음
    const isPasswordOk = await bcrypt.compare(dto.password, user.passwordHash)

    // 4. 비밀번호가 틀리면 로그인 실패입니다.
    if (!isPasswordOk) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      )
    }

    // 5. 로그인 성공 시 JWT 쿠키를 저장합니다.
    this.setCookie(res, user)

    // 6. 안전한 사용자 정보만 응답합니다.
    return this.safeUser(user)
  }

  // 현재 로그인한 사용자 정보를 가져오는 로직입니다.
  async me(userId: string) {
    // id 기본키로 사용자 조회
    // JwtStrategy에서 꺼낸 userId로 DB에서 사용자를 찾습니다.
    // 로그인이 성공하면 입력된 ID 값을 DB에서 찾아서 사용자 정보를 가져온다고? 애초에 로그인 검증할 때 DB에서 사용자 정보를 찾아서 ID가 맞는지, 비밀번호가 맞는지 검증하는데, 그 과정에서 사용자 정보도 가져오는 것 아닌가?
    // -> 맞음 로그인 검증 과정에서 DB에서 사용자 정보를 찾아서 ID와 비밀번호를 검증하는데, 그 과정에서 사용자 정보도 가져옴
    // 그래서 로그인 성공 후에 JWT 토큰을 만들어서 쿠키에 저장할 때도 사용자 정보가 필요함
    // 그러니까 결국 me 함수도 로그인 검증 과정에서 실행되는 거라는 건가
    // -> me 함수는 로그인 검증 과정에서 실행되는 게 아니라, 로그인한 사용자가 자신의 정보를 조회할 때 실행되는 함수임
    // 그럼 로그인 검증 과정에서 가져온 사용자 정보는 검증 후 아예 삭제되나?
    // -> 로그인 검증 과정에서 가져온 사용자 정보는 검증 후에도 남아있지만, 보통은 로그인 검증이 끝난 후에 JWT 토큰을 만들어서 쿠키에 저장하기 때문에, 그 이후에는 JWT 토큰에서 사용자 ID를 꺼내서 DB에서 다시 사용자 정보를 조회하는 방식으로 구현하는 경우가 많음
    // JWT 토큰을 쿠키로 저장하는데 결국 쿠키에서 사용자 정보를 꺼낸다는 거?
    // -> JWT 토큰에는 사용자 ID 같은 최소한의 정보만 담아서 쿠키에 저장하고, 실제로 사용자 정보를 조회할 때는 JWT 토큰에서 사용자 ID를 꺼내서 DB에서 다시 조회하는 방식이 일반적임
    // 그럼 브라우저에서 한번 쿠키 삭제하면 로그인이 좀 느려지나
    // -> 쿠키가 삭제되면 JWT 토큰도 사라지기 때문에, 사용자가 다시 로그인해야 함
    // 로그인 과정에서 JWT 토큰을 만들어서 쿠키에 저장하는 이유는, 사용자가 로그인한 상태를 유지하기 위해서임
    // 캐시와는 다른 개념이라고 했으니까 속도와는 관계가 없나
    // -> 맞음 JWT 토큰을 쿠키에 저장하는 것은 사용자의 로그인 상태를 유지하기 위한 방법이지, 캐시처럼 속도를 높이는 방법은 아님
    const user = await this.userRepository.findOneBy({ id: userId })

    // 사용자가 없으면 인증 실패로 처리합니다.
    if (!user) {
      throw new UnauthorizedException()
    }
    return this.safeUser(user)
  }

  // 로그아웃 로직입니다.
  // 쿠키를 이 아래에서 만드는 데 로그아웃 로직이 먼저 나와도 되나
  // -> AuthService 클래스 안에서 메서드의 순서는 크게 중요하지 않음
  // 왜냐하면 클래스가 만들어질 때 모든 메서드가 함께 정의되기 때문
  // 그래서 로그아웃 로직이 먼저 나와도 되고, 쿠키를 만드는 setCookie 메서드가 먼저 나와도 상관없음
  logout(res: Response) {
    // 브라우저에 저장된 access_token 쿠키를 삭제합니다.
    // 쿠키를 지울 때도 저장할 때와 같은 옵션을 맞춰주는 것이 안전합니다.
    // 뭐야 사용자가 브라우저 쿠키를 삭제하는 게 아니고 로그아웃 할 때 서버에서 쿠키가 삭제된다고?
    // -> 맞음 사용자가 로그아웃할 때 서버에서 쿠키를 삭제하는 방식으로 로그아웃을 구현하는 경우가 많음
    // 로그아웃할 때 서버에서 쿠키를 삭제하는 이유는, 사용자가 로그아웃 버튼을 클릭하면 서버에서 해당 사용자의 JWT 토큰이 담긴 쿠키를 삭제하여, 이후에 해당 쿠키가 포함된 요청이 오더라도 인증되지 않도록 하기 위함
    // 쿠키를 삭제했는데 이후에 해당 쿠키가 포함된 요청이 어떻게 옴?
    // -> 쿠키를 삭제했는데도 브라우저가 해당 쿠키를 계속 보내는 경우가 있을 수 있음-> 어떻게?
    // -> 쿠키 삭제는 브라우저가 해당 쿠키를 더 이상 저장하지 않도록 하는 것이지만, 이미 저장된 쿠키가 완전히 사라지는 것은 아니기 때문에, 브라우저가 해당 쿠키를 계속 보내는 경우가 있을 수 있음
    res.clearCookie('access_token', {
      // httpOnly: true로 설정한 쿠키는 JavaScript에서 직접 삭제할 수 없기 때문에, 서버에서 clearCookie를 사용하여 삭제해야 합니다.
      httpOnly: true,
      // sameSite과 secure 옵션도 쿠키를 설정할 때와 동일하게 맞춰주는 것이 좋습니다.
      // lax로 설정하면 같은 사이트 또는 일반적인 이동 요청에서는 쿠키를 보냅니다.
      sameSite: 'lax',
      secure: false,
      path: '/',
    })

    return { ok: true }
  }

  // JWT를 만들고 브라우저 쿠키에 저장하는 private 메서드입니다.
  // private은 이 클래스 내부에서만 사용할 수 있다는 뜻입니다.
  private setCookie(res: Response, user: User) {
    // 로그인한 사용자를 증명할 JWT 토큰을 만드는 코드입니다.
    const token = this.jwt.sign({ sub: user.id, email: user.email })

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
      // 그럼 계속 로그인 되어있어도 24시간 뒤엔 자동 로그아웃과 같은 거임?
      // -> JWT 토큰의 만료 시간과 쿠키의 유지 시간을 맞춰주는 것이 일반적이기 때문에,
      // JWT 토큰이 만료되면 쿠키도 더 이상 유효하지 않게 되어, 사용자가 다시 로그인해야 하는 상황이 발생할 수 있음
      // 근데 이거 24시간 해도 됨? 너무 길다는 얘기가 나왔는디 -> JWT 토큰의 만료 시간과 쿠키의 유지 시간을 설정할 때는 보안과 사용자 편의성 사이에서 균형을 맞추는 것이 중요함
      // 그럼 24시간동안... 내 컴퓨터로 한번 로그인하면 로그아웃 하기 전까진 브라우저 창 닫았다가 다시 열어도 로그인 상태라는 거?
      // -> 맞음 쿠키의 유지 시간이 24시간으로 설정되어 있다면, 사용자가 로그인한 후에 브라우저 창을 닫았다가 다시 열어도 로그인 상태가 유지될 수 있음
      // 근데 1시간으로 해 두면 1시간 뒤엔 무조건 로그인이 풀린다는 거잖아 -> 맞음 쿠키의 유지 시간이 1시간으로 설정되어 있다면, 사용자가 로그인한 후에 1시간이 지나면 쿠키가 만료되어 로그인 상태가 풀릴 수 있음
      // 그럼 로그인 풀리기 전에 연장은 불가능한가 -> JWT 토큰의 만료 시간을 연장하는 방법은 여러 가지가 있지만, 일반적으로는 사용자가 활동할 때마다 새로운 JWT 토큰을 발급하여 쿠키에 저장하는 방식으로 구현함
      // 그럼 1시간으로 해도 사용자가 계속 브라우저에서 작업하면 알아서 연장된다는 건가?
      // -> 사용자가 API 요청을 보낼 때마다 서버가 새 JWT 만들어서 쿠키 다시 내려주는 방식으로 구현하면 사용자가 계속 활동하는 동안 로그인 시간이 밀림
      // 혹은 Access Token + Refresh token 방식으로 구현하면 Access Token 만료되면 Refresh token으로 새 access token 발급받음
      maxAge: 1000 * 60 * 60 * 24,
    })
  }

  // 프론트엔드로 보내도 되는 사용자 정보만 골라서 반환합니다.
  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      steamId: user.steamId,
    }
  }
}
