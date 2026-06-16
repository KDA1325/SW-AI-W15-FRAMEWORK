// Controller, Get, Post 같은 데코레이터는 API 주소를 만들 때 사용합니다.
// Body는 요청 body를 꺼낼 때, Req/Res는 요청/응답 객체를 직접 다룰 때 사용합니다.
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'

// Express의 Request, Response 타입입니다.
import type { Request, Response } from 'express'

// 실제 회원가입/로그인 로직은 AuthService에 있습니다.
import { AuthService } from './auth.service'

// 로그인/회원가입 요청 body 타입입니다.
import { LinkSteamProfileDto } from './dto/link-steam-profile.dto'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'

// 로그인한 사용자만 접근할 수 있게 막는 Guard입니다.
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { SteamService } from './steam.service'

// JWT 인증에 성공하면 req.user에 userId와 email이 들어갑니다.
type AuthedRequest = Request & {
  user: { userId: string; email: string }
}

// 이 컨트롤러의 모든 API 주소는 /auth로 시작합니다.
@Controller('auth')
export class AuthController {
  // AuthService를 주입받아 컨트롤러에서 사용합니다.
  constructor(
    private authService: AuthService,
    private steamService: SteamService,
  ) {}

  // POST /auth/register
  // React에서 보낸 회원가입 요청을 처리합니다.
  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(dto, res)
  }

  // POST /auth/login
  // React에서 보낸 로그인 요청을 처리합니다.
  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res)
  }

  // POST /auth/logout
  // 브라우저의 로그인 쿠키를 삭제합니다.
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res)
  }

  // GET /auth/me
  // JwtAuthGuard가 먼저 로그인 여부를 검사합니다.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthedRequest) {
    // Guard와 Strategy를 통과하면 req.user.userId를 사용할 수 있습니다.
    return this.authService.me(req.user.userId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('steam/profile')
  steamProfile(@Req() req: AuthedRequest) {
    return this.steamService.getLinkedProfile(req.user.userId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('steam/link')
  linkSteamProfile(
    @Req() req: AuthedRequest,
    @Body() dto: LinkSteamProfileDto,
  ) {
    return this.steamService.linkProfile(req.user.userId, dto.steamProfile)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('steam/link')
  unlinkSteamProfile(@Req() req: AuthedRequest) {
    return this.steamService.unlinkProfile(req.user.userId)
  }
}
