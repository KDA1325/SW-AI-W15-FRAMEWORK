// Controller, Get, Post 같은 데코레이터는 API 주소를 만들 때 사용합니다.
// Body는 요청 body를 꺼낼 때, Req/Res는 요청/응답 객체를 직접 다룰 때 사용합니다.
import {
  Body,
  Controller,
  Get,
  Patch,
  Post, 
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

// TODO: 뭔지 정리하기 
import type { Request } from 'express';

// 로그인한 사용자만 접근할 수 있게 막는 Guard입니다.
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ArchivePostType } from './entities/archivePost.entity';

import CreatePostDto from './dto/create-post.dto';
import UpdatePostDto from './dto/update-post.dto';
import PostsService from './posts.service';

// TODO: 뭔지 정리하기 
type AuthedRequest = Request & {
  user: {
    userId: string;
    email: string;
  };
};

// 이 컨트롤러의 모든 API는 JWT 로그인 검사를 먼저 통과해야 합니다.
// Guard가 성공하면 req.user 안에 JwtStrategy가 반환한 userId/email이 들어갑니다.
@UseGuards(JwtAuthGuard)
// /posts로 시작하는 게시글 API 주소를 담당합니다.
@Controller('posts')
export class PostsController {
    // PostsController는 HTTP 요청을 해석하고, 실제 DB 작업은 PostsService에 맡깁니다.
    constructor(private postsService: PostsService) {}

    // POST /posts
    // 요청 body(CreatePostDto)와 로그인 사용자 id를 이용해 새 게시글을 생성합니다.
    @Post()
    create(@Req() req: AuthedRequest, @Body() dto: CreatePostDto) {
        // 작성자 id는 클라이언트가 보낸 값이 아니라 인증된 JWT의 userId를 사용합니다.
        return this.postsService.create(req.user.userId, dto)
    }
    
    // GET /posts
    // 게시글 목록을 조회합니다. type 쿼리를 주면 REVIEW/JOURNAL 중 하나만 필터링할 수 있습니다.
    // 예: GET /posts?type=REVIEW
    @Get()
    findAll(
        @Req() req: AuthedRequest,
        @Query('type') type?: ArchivePostType,
    ) {
        // userId는 각 게시글의 canEdit 계산처럼 사용자별 응답을 만들 때 사용됩니다.
        return this.postsService.findAll(req.user.userId, type)
    }
    
    // GET /posts/:id
    // URL의 :id 값을 꺼내 특정 게시글 하나를 조회합니다.
    @Get(':id')
    findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
        // 상세 조회 응답에는 현재 사용자가 수정/삭제할 수 있는지 나타내는 canEdit 값이 포함됩니다.
        return this.postsService.findOne(req.user.userId, id)
    }
    
    // PATCH /posts/:id
    // URL의 :id 게시글을 요청 body(UpdatePostDto)의 값으로 수정합니다.
    @Patch(':id')
    update(
        @Req() req: AuthedRequest,
        @Param('id') id: string,
        @Body() dto: UpdatePostDto,
    ) {
        // 실제 작성자 권한 검사는 PostsService.update 내부의 assertOwner에서 수행합니다.
        return this.postsService.update(req.user.userId, id, dto);
    }
    
    // DELETE /posts/:id
    // URL의 :id 게시글을 삭제합니다.
    @Delete(':id')
    remove(@Req() req: AuthedRequest, @Param('id') id: string) {
        // 삭제도 서비스에서 작성자 본인인지 확인한 뒤에만 실행됩니다.
        return this.postsService.remove(req.user.userId, id);
    }
}
