// Controller, Get, Post 같은 데코레이터는 API 주소를 만들 때 사용합니다.
// Body는 요청 body를 꺼낼 때, Req/Res는 요청/응답 객체를 직접 다룰 때 사용합니다.
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import CreateCommentDto from './dto/create-comment.dto';
import CreatePostDto from './dto/create-post.dto';
import UpdatePostDto from './dto/update-post.dto';
import {
    ArchivePost,
    ArchivePostType,
} from './entities/archivePost.entity';
import { Comment } from './entities/comment.entity';
import { Game } from '../auth/entities/game.entity';

type PostListSort = 'latest' | 'oldest' | 'rating';

// 요청 DTO를 DB 엔티티로 바꾸고 권한 규칙을 보장하기 
// PostsService는 컨트롤러에서 받은 DTO를 DB 엔티티로 바꾸고,
// 게시글 생성/조회/수정/삭제에 필요한 비즈니스 규칙을 보장합니다.
@Injectable()
export default class PostsService {
    constructor(
        @InjectRepository(ArchivePost)
        private postRepository: Repository<ArchivePost>,

        @InjectRepository(Comment)
        private commentRepository: Repository<Comment>,

        @InjectRepository(Game)
        private gameRepository: Repository<Game>,
    ) { }

    // 새 저널/리뷰를 저장합니다.
    // 작성자는 요청 body가 아니라 JWT에서 꺼낸 userId로 고정해서 위조를 막습니다.
    async create(userId: string, dto: CreatePostDto) {
        // REVIEW/JOURNAL 타입별 rating 규칙은 DB 저장 전에 먼저 검사합니다.
        this.validatePostPayload(dto.type, dto.rating);

        // 클라이언트는 gameTitle만 보내므로, 서버에서 Game 레코드를 찾아 연결합니다.
        const game = await this.findOrCreateGame(dto.gameTitle);

        const post = this.postRepository.create({
            userId,
            gameId: game.id,
            type: dto.type,
            title: dto.title,
            content: dto.content,
            rating: dto.type === ArchivePostType.REVIEW ? dto.rating! : null,
        });

        const savedPost = await this.postRepository.save(post);

        // 저장 직후 relation(game, user)과 canEdit까지 포함한 상세 응답을 재사용합니다.
        return this.findOne(userId, savedPost.id);
    }

    // 게시글 목록을 최신순으로 조회합니다.
    // type이 들어오면 REVIEW 또는 JOURNAL만 필터링하고, 없으면 전체를 반환합니다.
    async findAll(
        userId: string,
        type?: ArchivePostType,
        mineOnly = false,
        query?: string,
        sort?: string,
        limit?: string,
        page?: string,
    ) {
        const keyword = query?.trim();
        const normalizedSort = this.parseListSort(sort);
        // 기본값 설정? 
        const normalizedLimit = this.parseListLimit(limit);
        const normalizedPage = this.parsePositiveNumber(page, 1, 'page');
        // 목록 조회는 조건이 여러 개 조합됩니다.
        // - type: REVIEW 목록인지 JOURNAL 목록인지 구분
        // - mineOnly: 내 글만 볼지, 전체 글을 볼지 구분
        // - keyword: 제목/본문/게임 타이틀 검색어
        // TypeORM find()만으로도 단순 조회는 가능하지만,
        // "post.title OR post.content OR game.title"처럼 OR 조건을 묶고
        // game 테이블까지 join해서 검색하려면 QueryBuilder가 더 명확합니다.
        const postsQuery = this.postRepository
            .createQueryBuilder('post')
            .leftJoinAndSelect('post.game', 'game')
            .leftJoinAndSelect('post.user', 'user');

        // 오래된 순
        if (normalizedSort === 'oldest') {
            postsQuery.orderBy('post.createdAt', 'ASC');
        }
        // 평점 순 
        else if (normalizedSort === 'rating') {
            postsQuery.orderBy('post.rating', 'DESC', 'NULLS LAST');
        }
        // 최신 순  
        else {
            postsQuery.orderBy('post.createdAt', 'DESC');
        }

        postsQuery
            .take(normalizedLimit)
            .skip((normalizedPage - 1) * normalizedLimit);

        if (type) {
            postsQuery.andWhere('post.type = :type', { type });
        }

        if (mineOnly) {
            postsQuery.andWhere('post.userId = :userId', { userId });
        }

        if (keyword) {
            // 검색어가 있을 때만 검색 조건을 추가합니다.
            // Brackets는 괄호 역할을 합니다.
            // 즉 아래 조건은 SQL로 보면 대략 이런 의미입니다.
            // AND (
            //   post.title ILIKE '%검색어%'
            //   OR post.content ILIKE '%검색어%'
            //   OR game.title ILIKE '%검색어%'
            // )
            // ILIKE는 PostgreSQL에서 대소문자를 구분하지 않는 LIKE 검색입니다.
            // 그래서 사용자가 게임 제목 일부나 글 본문 키워드를 입력해도 결과를 찾을 수 있습니다.
            postsQuery.andWhere(
                new Brackets((qb) => {
                    qb.where('post.title ILIKE :keyword', { keyword: `%${keyword}%` })
                        .orWhere('post.content ILIKE :keyword', { keyword: `%${keyword}%` })
                        .orWhere('game.title ILIKE :keyword', { keyword: `%${keyword}%` });
                }),
            );
        }

        const posts = await postsQuery.getMany();

        // Timeline still receives all posts, while journals can request mineOnly for just my posts.
        // canEdit remains useful for shared list UIs that need to hide edit/delete controls.
        return posts.map((post) => ({
            ...post,
            canEdit: post.userId === userId,
        }));
    }

    // 게시글 상세를 조회합니다.
    // canEdit은 프론트에서 수정/삭제 버튼 노출 여부를 판단할 수 있도록 내려주는 값입니다.
    async findOne(userId: string, id: string) {
        const post = await this.postRepository.findOne({
            where: { id },
            relations: {
                game: true,
                user: true,
                // 상세 페이지 댓글 영역은 댓글 작성자 이름과 대댓글까지 필요합니다.
                // 그래서 post.comments만 가져오지 않고 comments.user, comments.replies.user까지 함께 가져옵니다.
                // 이렇게 해두면 프론트에서 댓글마다 추가 API를 호출하지 않고 한 번의 상세 조회로 화면을 그릴 수 있습니다.
                comments: {
                    user: true,
                    replies: {
                        user: true,
                    },
                },
            },
            order: {
                // 댓글은 오래된 댓글부터 아래로 쌓이는 형태가 자연스럽습니다.
                // createdAt ASC는 먼저 작성된 댓글이 먼저 오도록 정렬한다는 뜻입니다.
                // replies도 같은 기준으로 정렬해서 대댓글 순서가 매번 흔들리지 않게 합니다.
                comments: {
                    createdAt: 'ASC',
                    replies: {
                        createdAt: 'ASC',
                    },
                },
            },
        });

        if (!post) {
            throw new NotFoundException('게시글을 찾을 수 없습니다.');
        }

        return {
            ...post,
            canEdit: post.userId === userId,
        };
    }

    // 댓글 작성 API에서 사용하는 서비스 메서드입니다.
    // postId는 URL의 /posts/:id/comments에서 온 값이고, userId는 JWT에서 꺼낸 로그인 사용자 id입니다.
    // 댓글 저장 후에는 새 댓글이 포함된 상세 데이터를 다시 반환해서 프론트가 화면을 바로 갱신할 수 있게 합니다.
    async createComment(userId: string, postId: string, dto: CreateCommentDto) {
        await this.findPostOrThrow(postId);

        if (dto.parentCommentId) {
            const parentComment = await this.commentRepository.findOne({
                where: {
                    id: dto.parentCommentId,
                    postId,
                },
            });

            if (!parentComment) {
                throw new BadRequestException('대댓글을 달 원본 댓글을 찾을 수 없습니다.');
            }
        }

        const comment = this.commentRepository.create({
            postId,
            userId,
            parentCommentId: dto.parentCommentId ?? null,
            content: dto.content,
        });

        await this.commentRepository.save(comment);

        return this.findOne(userId, postId);
    }

    // 게시글을 수정합니다.
    // 수정 전에 반드시 소유자 검사를 해서 본인 글만 변경할 수 있게 합니다.
    async update(userId: string, id: string, dto: UpdatePostDto) {
        const post = await this.findPostOrThrow(id);
        this.assertOwner(post, userId);

        // 게임 제목이 바뀌면 새 제목에 해당하는 Game을 찾아 다시 연결합니다.
        if (dto.gameTitle) {
            const game = await this.findOrCreateGame(dto.gameTitle);
            post.gameId = game.id;
        }

        if (dto.title !== undefined) {
            post.title = dto.title;
        }

        if (dto.content !== undefined) {
            post.content = dto.content;
        }

        if (dto.rating !== undefined) {
            if (post.type !== ArchivePostType.REVIEW) {
                throw new BadRequestException('저널에는 평점을 저장할 수 없습니다.');
            }

            post.rating = dto.rating;
        }

        await this.postRepository.save(post);

        return this.findOne(userId, id);
    }

    // 게시글을 삭제합니다.
    // 삭제도 수정과 마찬가지로 작성자 본인에게만 허용합니다.
    async remove(userId: string, id: string) {
        const post = await this.findPostOrThrow(id);
        this.assertOwner(post, userId);

        await this.postRepository.remove(post);

        return { ok: true };
    }

    // gameTitle을 기준으로 Game을 찾고, 아직 없으면 새로 만듭니다.
    // 게시글은 gameId를 필요로 하므로 생성 API에서 공통으로 사용하는 helper입니다.
    private async findOrCreateGame(gameTitle: string) {
        const title = gameTitle.trim();

        let game = await this.gameRepository.findOne({
            where: { title },
        });

        if (!game) {
            game = this.gameRepository.create({
                title,
            });

            game = await this.gameRepository.save(game);
        }

        return game;
    }

    // id로 게시글을 찾고, 없으면 404 예외를 던집니다.
    // update/remove처럼 존재 확인이 먼저 필요한 흐름에서 중복을 줄이기 위한 helper입니다.
    private async findPostOrThrow(id: string) {
        const post = await this.postRepository.findOne({
            where: { id },
        });

        if (!post) {
            throw new NotFoundException('게시글을 찾을 수 없습니다.');
        }

        return post;
    }

    // 로그인한 사용자와 게시글 작성자가 같은지 검사합니다.
    // 다르면 403으로 막아 "본인 글만 수정/삭제" 완료 기준을 만족시킵니다.
    private assertOwner(post: ArchivePost, userId: string) {
        if (post.userId !== userId) {
            throw new ForbiddenException('본인 글만 수정하거나 삭제할 수 있습니다.');
        }
    }

    private parseListSort(sort?: string): PostListSort {
        if (!sort) {
            return 'latest';
        }
        
        // sort 종류 검증 
        if (sort === 'latest' || sort === 'oldest' || sort === 'rating') {
            return sort;
        }

        throw new BadRequestException('sort는 latest, oldest, rating 중 하나여야 합니다.');
    }

    private parsePositiveNumber(value: string | undefined, defaultValue: number, field: string) {
        if (!value) {
            return defaultValue;
        }

        const parsed = Number(value);

        if (!Number.isInteger(parsed) || parsed < 1) {
            throw new BadRequestException(`${field}는 1 이상의 정수여야 합니다.`);
        }

        return parsed;
    }

    // 리스트 보기 개수 5, 10, 15개 제한 
    private parseListLimit(limit?: string) {
        if (!limit) {
            return 10;
        }

        const parsed = Number(limit);

        if (parsed === 5 || parsed === 10 || parsed === 15) {
            return parsed;
        }

        throw new BadRequestException('limit must be one of 5, 10, 15.');
    }

    // REVIEW는 rating이 필수이고, JOURNAL은 rating을 받지 않는다는 도메인 규칙입니다.
    // DTO는 기본 타입/범위를 검증하고, 타입 간 조건부 규칙은 서비스에서 검사합니다.
    private validatePostPayload(type: ArchivePostType, rating?: number) {
        if (type === ArchivePostType.REVIEW && rating === undefined) {
            throw new BadRequestException('리뷰에는 평점이 필요합니다.');
        }

        if (type === ArchivePostType.JOURNAL && rating !== undefined) {
            throw new BadRequestException('저널에는 평점을 저장할 수 없습니다.');
        }
    }

}
