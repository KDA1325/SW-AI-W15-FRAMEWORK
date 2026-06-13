// Controller, Get, Post 같은 데코레이터는 API 주소를 만들 때 사용합니다.
// Body는 요청 body를 꺼낼 때, Req/Res는 요청/응답 객체를 직접 다룰 때 사용합니다.
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import PostsService from './posts.service';

import CreatePostDto from './dto/create-post.dto';

// // 로그인한 사용자만 접근할 수 있게 막는 Guard입니다.
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// // JWT 인증에 성공하면 req.user에 userId가 들어갑니다.
// type AuthedRequest = Request & {
//   user: { userId: string; };
// };

@Controller('createPost')
export class PostsController {
    constructor(private postsService: PostsService) {}

    // POST /createPost/post
    @Post('post')
    create() {
        // return this.postsService.()
    }
    
    // GET /createPost/read
    @Get('read')
    findAll() {

        // return this.postsService.()
    }
    
    // GET /createPost/:id
    @Get(':id')
    findOne() {
        
        // return this.postsService.()
    }
    
    // PATCH /createPost/:id
    @Patch(':id')
    update() {

        // return this.postsService.()
    }
    
    // DELETE /createPost/:id
    @Delete(':id')
    remove() {

        // return this.postsService.()
    }
}