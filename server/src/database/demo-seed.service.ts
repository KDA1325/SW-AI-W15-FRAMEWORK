import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AI_RECOMMENDATION_DEMO_USER_ID } from '../ai/recommendation-contract';
import { AiProfile } from '../auth/entities/aiProfile.entity';
import {
  EmbeddingDocument,
  EmbeddingSourceType,
} from '../auth/entities/embeddingDocument.entity';
import { Game } from '../auth/entities/game.entity';
import { Recommendation } from '../auth/entities/recommendation.entity';
import { User } from '../auth/entities/user.entity';
import { UserGame } from '../auth/entities/userGame.entity';
import {
  ArchivePost,
  ArchivePostType,
} from '../posts/entities/archivePost.entity';
import { PgvectorSetupService } from './pgvector-setup.service';

const DEMO_NOW = new Date('2026-06-16T03:00:00.000Z');
const DEMO_EMBEDDING_DIMENSIONS = 1536;

const DEMO_IDS = {
  aiProfile: '00000000-0000-4000-8000-000000000101',
  embeddings: {
    intoTheBreachReview: '00000000-0000-4000-8000-000000000301',
    discoElysiumJournal: '00000000-0000-4000-8000-000000000302',
    crossCodeJournal: '00000000-0000-4000-8000-000000000303',
    aiProfile: '00000000-0000-4000-8000-000000000304',
    crossCodeGame: '00000000-0000-4000-8000-000000000305',
  },
  games: {
    intoTheBreach: '00000000-0000-4000-8000-000000000201',
    discoElysium: '00000000-0000-4000-8000-000000000202',
    crossCode: '00000000-0000-4000-8000-000000000203',
  },
  posts: {
    intoTheBreachReview: '11111111-1111-4111-8111-111111111111',
    discoElysiumJournal: '22222222-2222-4222-8222-222222222222',
    crossCodeJournal: '33333333-3333-4333-8333-333333333333',
  },
  recommendations: {
    crossCode: '00000000-0000-4000-8000-000000000401',
  },
  userGames: {
    intoTheBreach: '00000000-0000-4000-8000-000000000501',
    discoElysium: '00000000-0000-4000-8000-000000000502',
  },
} as const;

type DemoGameKey = keyof typeof DEMO_IDS.games;

const DEMO_GAMES: Array<{
  key: DemoGameKey;
  id: string;
  steamAppId: string;
  title: string;
  imageUrl: string;
  description: string;
  genres: string[];
  platforms: string[];
  tags: string[];
}> = [
  {
    key: 'intoTheBreach',
    id: DEMO_IDS.games.intoTheBreach,
    steamAppId: '590380',
    title: 'Into the Breach',
    imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/590380/header.jpg',
    description:
      'A compact tactics game where every enemy intention is visible before the player commits.',
    genres: ['Strategy', 'Turn-Based Tactics'],
    platforms: ['PC', 'Steam'],
    tags: ['Turn-Based', 'Tactical', 'Difficult', 'Replay Value'],
  },
  {
    key: 'discoElysium',
    id: DEMO_IDS.games.discoElysium,
    steamAppId: '632470',
    title: 'Disco Elysium',
    imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/632470/header.jpg',
    description:
      'A narrative RPG about identity, politics, and investigation through conversation systems.',
    genres: ['RPG', 'Narrative'],
    platforms: ['PC', 'Steam'],
    tags: ['Story Rich', 'Choices Matter', 'Detective', 'Atmospheric'],
  },
  {
    key: 'crossCode',
    id: DEMO_IDS.games.crossCode,
    steamAppId: '368340',
    title: 'CrossCode',
    imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/368340/header.jpg',
    description:
      'A pixel-art action RPG with puzzle dungeons, readable combat patterns, and long-form progression.',
    genres: ['Action RPG', 'Puzzle'],
    platforms: ['PC', 'Steam'],
    tags: ['Pixel Graphics', 'Story Rich', 'Action RPG', 'Puzzle'],
  },
];

const DEMO_POSTS: Array<{
  id: string;
  gameKey: DemoGameKey;
  type: ArchivePostType;
  title: string;
  content: string;
  rating: number | null;
}> = [
  {
    id: DEMO_IDS.posts.intoTheBreachReview,
    gameKey: 'intoTheBreach',
    type: ArchivePostType.REVIEW,
    title: 'Boss patterns feel fair when the rules are visible',
    content:
      'I enjoyed how every loss taught me a clearer tactical rule instead of asking for more grinding. The best moments came from reading enemy intent, planning two turns ahead, and accepting a tiny sacrifice for a cleaner board state.',
    rating: 5,
  },
  {
    id: DEMO_IDS.posts.discoElysiumJournal,
    gameKey: 'discoElysium',
    type: ArchivePostType.JOURNAL,
    title: 'Conversation systems can feel like combat',
    content:
      'The journal moment that stayed with me was how dialogue checks felt strategic without becoming a puzzle checklist. I like RPGs that let personality, failure, and worldbuilding change the route through a scene.',
    rating: null,
  },
  {
    id: DEMO_IDS.posts.crossCodeJournal,
    gameKey: 'crossCode',
    type: ArchivePostType.JOURNAL,
    title: 'Pixel dungeons work when execution has rhythm',
    content:
      'Fast action is most satisfying when the screen language is readable. CrossCode made me notice that I prefer retro presentation when it supports precise timing, spatial puzzles, and a strong adventure loop.',
    rating: null,
  },
];

@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly pgvectorSetup: PgvectorSetupService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.isSeedEnabled()) {
      return;
    }

    await this.pgvectorSetup.ensurePgvector();

    const user = await this.seedUser();
    const games = await this.seedGames();
    const posts = await this.seedPosts(user.id, games);
    const aiProfile = await this.seedAiProfile(user.id);

    await this.seedUserGames(user.id, games);
    await this.seedRecommendations(user.id, games);
    await this.seedEmbeddingDocuments(games, posts, aiProfile);

    this.logger.log(
      `Demo AI seed ready for ${user.email} (${AI_RECOMMENDATION_DEMO_USER_ID}).`,
    );
  }

  private isSeedEnabled(): boolean {
    const rawValue = this.config.get<string>('DEMO_SEED_ENABLED') ?? 'true';
    return rawValue.toLowerCase() !== 'false';
  }

  private async seedUser(): Promise<User> {
    const repository = this.dataSource.getRepository(User);
    const email =
      this.config.get<string>('DEMO_USER_EMAIL') ?? 'demo@gaming-journal.club';
    const password =
      this.config.get<string>('DEMO_USER_PASSWORD') ?? 'demo-password';
    const steamId = this.config.get<string>('DEMO_STEAM_ID') || null;

    let user = await repository.findOne({
      where: [{ id: AI_RECOMMENDATION_DEMO_USER_ID }, { email }],
    });

    const passwordHash =
      user?.passwordHash ?? (await bcrypt.hash(password, 12));

    if (!user) {
      user = repository.create({ id: AI_RECOMMENDATION_DEMO_USER_ID });
    }

    user.email = email;
    user.passwordHash = passwordHash;
    user.nickname = 'DEMO_PLAYER';
    user.bio =
      'Tactical, narrative, and retro RPG player prepared for the AI recommendation MVP.';
    user.profileImageUrl = null;
    user.gamerTags = ['TACTICAL_RPG', 'STORY_DRIVEN', 'RETRO_PIXEL'];
    user.steamId = steamId;

    return repository.save(user);
  }

  private async seedGames(): Promise<Record<DemoGameKey, Game>> {
    const repository = this.dataSource.getRepository(Game);
    const games = {} as Record<DemoGameKey, Game>;

    for (const seed of DEMO_GAMES) {
      let game = await repository.findOne({
        where: [{ id: seed.id }, { steamAppId: seed.steamAppId }],
      });

      if (!game) {
        game = repository.create({ id: seed.id });
      }

      game.steamAppId = seed.steamAppId;
      game.igdbId = null;
      game.title = seed.title;
      game.imageUrl = seed.imageUrl;
      game.description = seed.description;
      game.genres = seed.genres;
      game.platforms = seed.platforms;
      game.tags = seed.tags;

      games[seed.key] = await repository.save(game);
    }

    return games;
  }

  private async seedPosts(
    userId: string,
    games: Record<DemoGameKey, Game>,
  ): Promise<Record<string, ArchivePost>> {
    const repository = this.dataSource.getRepository(ArchivePost);
    const posts: Record<string, ArchivePost> = {};

    for (const seed of DEMO_POSTS) {
      const game = games[seed.gameKey];
      let post = await repository.findOne({ where: { id: seed.id } });

      if (!post) {
        post = repository.create({ id: seed.id });
      }

      post.userId = userId;
      post.gameId = game.id;
      post.type = seed.type;
      post.title = seed.title;
      post.content = seed.content;
      post.rating = seed.rating;

      posts[seed.id] = await repository.save(post);
    }

    return posts;
  }

  private async seedAiProfile(userId: string): Promise<AiProfile> {
    const repository = this.dataSource.getRepository(AiProfile);
    let profile = await repository.findOne({ where: { userId } });

    if (!profile) {
      profile = repository.create({ id: DEMO_IDS.aiProfile, userId });
    }

    profile.playStyleSummary =
      'You favor deliberate combat, readable systems, and games where repeated failure reveals better strategy rather than pure grind.';
    profile.favoriteKeywords = [
      'TACTICAL_RPG',
      'STORY_DRIVEN',
      'RETRO_PIXEL',
      'HIGH_DIFFICULTY',
    ];
    profile.favoriteGenres = ['Strategy', 'RPG', 'Action RPG'];
    profile.lastAnalyzedAt = DEMO_NOW;

    return repository.save(profile);
  }

  private async seedUserGames(
    userId: string,
    games: Record<DemoGameKey, Game>,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(UserGame);
    const rows = [
      {
        id: DEMO_IDS.userGames.intoTheBreach,
        game: games.intoTheBreach,
        totalPlaytimeMinutes: 1260,
        recentPlaytimeMinutes: 180,
        achievementRate: 72,
      },
      {
        id: DEMO_IDS.userGames.discoElysium,
        game: games.discoElysium,
        totalPlaytimeMinutes: 2140,
        recentPlaytimeMinutes: 420,
        achievementRate: 58,
      },
    ];

    for (const row of rows) {
      let userGame = await repository.findOne({ where: { id: row.id } });

      if (!userGame) {
        userGame = repository.create({ id: row.id });
      }

      userGame.userId = userId;
      userGame.gameId = row.game.id;
      userGame.totalPlaytimeMinutes = row.totalPlaytimeMinutes;
      userGame.recentPlaytimeMinutes = row.recentPlaytimeMinutes;
      userGame.achievementRate = row.achievementRate;
      userGame.lastPlayedAt = DEMO_NOW;

      await repository.save(userGame);
    }
  }

  private async seedRecommendations(
    userId: string,
    games: Record<DemoGameKey, Game>,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(Recommendation);
    let recommendation = await repository.findOne({
      where: { id: DEMO_IDS.recommendations.crossCode },
    });

    if (!recommendation) {
      recommendation = repository.create({
        id: DEMO_IDS.recommendations.crossCode,
      });
    }

    recommendation.userId = userId;
    recommendation.gameId = games.crossCode.id;
    recommendation.rank = 1;
    recommendation.score = 0.93;
    recommendation.reason =
      'Seed recommendation for the AI MVP: precise combat, readable pixel art, and story-rich RPG structure match the demo player profile.';

    await repository.save(recommendation);
  }

  private async seedEmbeddingDocuments(
    games: Record<DemoGameKey, Game>,
    posts: Record<string, ArchivePost>,
    aiProfile: AiProfile,
  ): Promise<void> {
    const documents = [
      {
        id: DEMO_IDS.embeddings.intoTheBreachReview,
        sourceType: EmbeddingSourceType.ARCHIVE_POST,
        sourceId: posts[DEMO_IDS.posts.intoTheBreachReview].id,
        title: DEMO_POSTS[0].title,
        gameTitle: games.intoTheBreach.title,
        content: this.postEmbeddingContent(DEMO_POSTS[0], games.intoTheBreach),
      },
      {
        id: DEMO_IDS.embeddings.discoElysiumJournal,
        sourceType: EmbeddingSourceType.ARCHIVE_POST,
        sourceId: posts[DEMO_IDS.posts.discoElysiumJournal].id,
        title: DEMO_POSTS[1].title,
        gameTitle: games.discoElysium.title,
        content: this.postEmbeddingContent(DEMO_POSTS[1], games.discoElysium),
      },
      {
        id: DEMO_IDS.embeddings.crossCodeJournal,
        sourceType: EmbeddingSourceType.ARCHIVE_POST,
        sourceId: posts[DEMO_IDS.posts.crossCodeJournal].id,
        title: DEMO_POSTS[2].title,
        gameTitle: games.crossCode.title,
        content: this.postEmbeddingContent(DEMO_POSTS[2], games.crossCode),
      },
      {
        id: DEMO_IDS.embeddings.aiProfile,
        sourceType: EmbeddingSourceType.AI_PROFILE,
        sourceId: aiProfile.id,
        title: 'DEMO_PLAYER AI profile',
        gameTitle: null,
        content: [
          aiProfile.playStyleSummary,
          aiProfile.favoriteKeywords.join(', '),
          aiProfile.favoriteGenres.join(', '),
        ].join('\n'),
      },
      {
        id: DEMO_IDS.embeddings.crossCodeGame,
        sourceType: EmbeddingSourceType.GAME,
        sourceId: games.crossCode.id,
        title: games.crossCode.title,
        gameTitle: games.crossCode.title,
        content: this.gameEmbeddingContent(games.crossCode),
      },
    ];

    for (const document of documents) {
      await this.upsertEmbeddingDocument(document);
    }
  }

  private async upsertEmbeddingDocument(seed: {
    id: string;
    sourceType: EmbeddingSourceType;
    sourceId: string;
    title: string;
    gameTitle: string | null;
    content: string;
  }): Promise<void> {
    const repository = this.dataSource.getRepository(EmbeddingDocument);
    let document = await repository.findOne({
      where: {
        sourceType: seed.sourceType,
        sourceId: seed.sourceId,
      },
    });

    if (!document) {
      document = repository.create({ id: seed.id });
    }

    document.sourceType = seed.sourceType;
    document.sourceId = seed.sourceId;
    document.content = seed.content;
    document.metadata = {
      dimensions: DEMO_EMBEDDING_DIMENSIONS,
      gameTitle: seed.gameTitle,
      model: 'demo-hash-embedding-v1',
      title: seed.title,
    };

    const savedDocument = await repository.save(document);
    const embedding = this.buildDemoEmbedding(seed.content);

    await this.dataSource.query(
      `
        UPDATE "EmbeddingDocument"
        SET "embedding" = $1::vector
        WHERE "id" = $2
      `,
      [this.toVectorLiteral(embedding), savedDocument.id],
    );
  }

  private postEmbeddingContent(
    post: (typeof DEMO_POSTS)[number],
    game: Game,
  ): string {
    return [
      `Post type: ${post.type}`,
      `Game: ${game.title}`,
      `Title: ${post.title}`,
      `Content: ${post.content}`,
      `Game tags: ${game.tags.join(', ')}`,
    ].join('\n');
  }

  private gameEmbeddingContent(game: Game): string {
    return [
      `Game: ${game.title}`,
      `Description: ${game.description ?? ''}`,
      `Genres: ${game.genres.join(', ')}`,
      `Tags: ${game.tags.join(', ')}`,
      `Platforms: ${game.platforms.join(', ')}`,
    ].join('\n');
  }

  private buildDemoEmbedding(seedText: string): number[] {
    // This deterministic vector is only for local seed data; GJC-80 will replace it with model embeddings.
    let hash = 2166136261;

    for (const char of seedText) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }

    return Array.from({ length: DEMO_EMBEDDING_DIMENSIONS }, (_, index) => {
      hash ^= index + 1;
      hash = Math.imul(hash, 16777619);

      const normalized = (hash >>> 0) / 4294967295;
      return Number((normalized * 2 - 1).toFixed(6));
    });
  }

  private toVectorLiteral(values: number[]): string {
    return `[${values.join(',')}]`;
  }
}
