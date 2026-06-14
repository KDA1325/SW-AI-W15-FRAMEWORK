import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import CreatePostDto from './dto/create-post.dto';
import UpdatePostDto from './dto/update-post.dto';
import { ArchivePostType } from './entities/archivePost.entity';
import PostsService from './posts.service';

// JwtStrategy가 JWT 검증 후 req.user에 넣어주는 값의 모양입니다.
// 컨트롤러는 이 userId를 신뢰해서 작성자/조회자 기준으로 서비스에 넘깁니다.
type AuthedRequest = Request & {
  user: {
    userId: string;
    email: string;
  };
};

// posts API는 모두 로그인한 사용자만 접근할 수 있습니다.
// 로그인하지 않은 요청은 컨트롤러 메서드에 도달하기 전에 JwtAuthGuard에서 막힙니다.
@UseGuards(JwtAuthGuard)
// /posts로 시작하는 저널/리뷰 게시글 API를 담당합니다.
@Controller('posts')
export class PostsController {
  // 컨트롤러는 HTTP 요청 값만 꺼내고, 실제 DB 처리와 권한 검사는 PostsService에 맡깁니다.
  constructor(private postsService: PostsService) {}

  // POST /posts
  // Creates a journal or review for the currently signed-in user.
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePostDto) {
    // 작성자 userId는 body에서 받지 않고 JWT에서 가져와 위조를 막습니다.
    return this.postsService.create(req.user.userId, dto);
  }

  // GET /posts
  // Timeline can omit mine so it receives every user's posts.
  // Journals page passes mine=true so it receives only the signed-in user's posts.
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('type') type?: ArchivePostType,
    @Query('mine') mine?: string,
  ) {
    // type은 REVIEW/JOURNAL 섹션 필터이고, mine=true는 내 게시글만 보는 필터입니다.
    // Query 값은 문자열로 들어오므로 'true'와 직접 비교해 boolean으로 바꿉니다.
    return this.postsService.findAll(req.user.userId, type, mine === 'true');
  }

  // GET /posts/:id
  // Returns one post with canEdit calculated for the current user.
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    // 상세 조회에서도 현재 사용자를 넘겨 canEdit을 계산하게 합니다.
    return this.postsService.findOne(req.user.userId, id);
  }

  // PATCH /posts/:id
  // The service checks ownership before applying updates.
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    // 서비스에서 post.userId와 req.user.userId를 비교해 본인 글만 수정합니다.
    return this.postsService.update(req.user.userId, id, dto);
  }

  // DELETE /posts/:id
  // The service checks ownership before deleting.
  @Delete(':id')
  remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    // 서비스에서 소유자 검사를 통과한 경우에만 삭제됩니다.
    return this.postsService.remove(req.user.userId, id);
  }
}
