import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import axios from 'axios';
import { DataSource } from 'typeorm';
import {
  AiPreferenceTag,
  AiRagAnalysisResponse,
  AiRagContextSource,
  AiRagEmbeddingProvider,
  AiWordCloudTerm,
} from './recommendation-contract';
import {
  buildDemoEmbedding,
  DEMO_EMBEDDING_DIMENSIONS,
  DEMO_EMBEDDING_MODEL,
  toPgVectorLiteral,
} from './demo-embedding';
import {
  EmbeddingDocument,
  EmbeddingSourceType,
} from '../auth/entities/embeddingDocument.entity';

const DEFAULT_TOP_K = 6;
const MAX_TOP_K = 12;
const MAX_EMBEDDING_INPUT_CHARS = 12000;

type RagOptions = {
  refreshEmbeddings?: boolean;
  topK?: number;
};

type ArchivePostRow = {
  id: string;
  type: 'REVIEW' | 'JOURNAL';
  title: string;
  content: string;
  rating: number | null;
  gameTitle: string;
  gameGenres: string[];
  gamePlatforms: string[];
  gameTags: string[];
  updatedAt: Date;
};

type UserGameRow = {
  achievementRate: number | null;
  gameDescription: string | null;
  gameGenres: string[];
  gameId: string;
  gamePlatforms: string[];
  gameTags: string[];
  gameTitle: string;
  lastPlayedAt: Date | null;
  recentPlaytimeMinutes: number;
  totalPlaytimeMinutes: number;
};

type RagSearchRow = {
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: {
    gameTitle?: string | null;
    title?: string;
  };
  similarity: string | number;
};

type EmbeddingResult = {
  dimensions: number;
  model: string;
  provider: AiRagEmbeddingProvider;
  values: number[];
};

type RagAnalysisDraft = {
  preferenceTags: AiPreferenceTag[];
  playStyleSummary: string;
  wordCloud: AiWordCloudTerm[];
};

type OpenAiEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
  model?: string;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async analyzeForUser(
    userId: string,
    options: RagOptions = {},
  ): Promise<AiRagAnalysisResponse> {
    const topK = this.normalizeTopK(options.topK);
    const posts = await this.loadUserArchivePosts(userId);
    const playedGames = await this.loadUserGameRecords(userId);
    const refreshedDocuments =
      options.refreshEmbeddings === false
        ? 0
        : await this.refreshArchiveEmbeddings(posts);

    const queryText = this.buildPreferenceQuery(posts, playedGames);
    const queryEmbedding = await this.createEmbedding(queryText);
    const searchRows = await this.searchContextRows(
      userId,
      queryEmbedding.values,
      topK,
    );
    const contextRows = [
      ...searchRows,
      ...playedGames.map((game) => this.toUserGameContextRow(game)),
    ];
    const analysis = await this.createAnalysis(contextRows);

    return {
      userId,
      generatedAt: new Date().toISOString(),
      ...analysis,
      contextSources: contextRows.map((row) => this.toContextSource(row)),
      embedding: {
        provider: queryEmbedding.provider,
        model: queryEmbedding.model,
        dimensions: queryEmbedding.dimensions,
        refreshedDocuments,
      },
    };
  }

  private normalizeTopK(value?: number): number {
    if (!value || !Number.isInteger(value) || value < 1) {
      return DEFAULT_TOP_K;
    }

    return Math.min(value, MAX_TOP_K);
  }

  private async loadUserArchivePosts(
    userId: string,
  ): Promise<ArchivePostRow[]> {
    return this.dataSource.query<ArchivePostRow[]>(
      `
        SELECT
          post.id,
          post.type,
          post.title,
          post.content,
          post.rating,
          post."updatedAt",
          game.title AS "gameTitle",
          game.genres AS "gameGenres",
          game.platforms AS "gamePlatforms",
          game.tags AS "gameTags"
        FROM "ArchivePost" post
        INNER JOIN "Game" game ON game.id = post."gameId"
        WHERE post."userId" = $1
        ORDER BY post."updatedAt" DESC
      `,
      [userId],
    );
  }

  private async loadUserGameRecords(userId: string): Promise<UserGameRow[]> {
    return this.dataSource.query<UserGameRow[]>(
      `
        SELECT
          user_game."gameId",
          user_game."totalPlaytimeMinutes",
          user_game."recentPlaytimeMinutes",
          user_game."achievementRate",
          user_game."lastPlayedAt",
          game.title AS "gameTitle",
          game.description AS "gameDescription",
          game.genres AS "gameGenres",
          game.platforms AS "gamePlatforms",
          game.tags AS "gameTags"
        FROM "UserGame" user_game
        INNER JOIN "Game" game ON game.id = user_game."gameId"
        WHERE user_game."userId" = $1
        ORDER BY user_game."lastPlayedAt" DESC NULLS LAST, user_game."updatedAt" DESC
      `,
      [userId],
    );
  }

  private async refreshArchiveEmbeddings(
    posts: ArchivePostRow[],
  ): Promise<number> {
    let refreshed = 0;

    for (const post of posts) {
      const content = this.buildArchiveEmbeddingContent(post);
      const embedding = await this.createEmbedding(content);
      const repository = this.dataSource.getRepository(EmbeddingDocument);

      let document = await repository.findOne({
        where: {
          sourceType: EmbeddingSourceType.ARCHIVE_POST,
          sourceId: post.id,
        },
      });

      if (!document) {
        document = repository.create();
      }

      document.sourceType = EmbeddingSourceType.ARCHIVE_POST;
      document.sourceId = post.id;
      document.content = content;
      document.metadata = {
        dimensions: embedding.dimensions,
        gameTitle: post.gameTitle,
        model: embedding.model,
        provider: embedding.provider,
        title: post.title,
        updatedAt: post.updatedAt,
      };

      const savedDocument = await repository.save(document);

      await this.dataSource.query(
        `
          UPDATE "EmbeddingDocument"
          SET "embedding" = $1::vector
          WHERE "id" = $2
        `,
        [toPgVectorLiteral(embedding.values), savedDocument.id],
      );

      refreshed += 1;
    }

    return refreshed;
  }

  private buildArchiveEmbeddingContent(post: ArchivePostRow): string {
    return [
      `Post type: ${post.type}`,
      `Game: ${post.gameTitle}`,
      `Title: ${post.title}`,
      `Content: ${post.content}`,
      `Rating: ${post.rating ?? 'none'}`,
      `Genres: ${post.gameGenres.join(', ')}`,
      `Tags: ${post.gameTags.join(', ')}`,
      `Platforms: ${post.gamePlatforms.join(', ')}`,
    ].join('\n');
  }

  private buildPreferenceQuery(
    posts: ArchivePostRow[],
    playedGames: UserGameRow[],
  ): string {
    if (posts.length === 0 && playedGames.length === 0) {
      return 'Gaming Journal Club player taste profile with no archive posts yet.';
    }

    // Only current-user writing and play records become the RAG query text, so another player's history cannot affect this analysis.
    const postSignals = posts.map((post) =>
      [
        post.gameTitle,
        post.title,
        post.content,
        post.gameGenres.join(', '),
        post.gameTags.join(', '),
      ].join('\n'),
    );
    const playSignals = playedGames.map((game) =>
      [
        `Played game: ${game.gameTitle}`,
        `Description: ${game.gameDescription ?? ''}`,
        `Total playtime minutes: ${game.totalPlaytimeMinutes}`,
        `Recent playtime minutes: ${game.recentPlaytimeMinutes}`,
        `Achievement rate: ${game.achievementRate ?? 'unknown'}`,
        `Genres: ${game.gameGenres.join(', ')}`,
        `Tags: ${game.gameTags.join(', ')}`,
        `Platforms: ${game.gamePlatforms.join(', ')}`,
      ].join('\n'),
    );

    return [...postSignals, ...playSignals].join('\n\n');
  }

  private async createEmbedding(text: string): Promise<EmbeddingResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    const model =
      this.config.get<string>('OPENAI_EMBEDDING_MODEL') ??
      'text-embedding-3-small';
    const dimensions = Number(
      this.config.get<string>('OPENAI_EMBEDDING_DIMENSIONS') ??
        DEMO_EMBEDDING_DIMENSIONS,
    );

    if (!apiKey) {
      return this.createDemoEmbedding(text);
    }

    try {
      const embeddingInput = this.truncateEmbeddingInput(text);
      const payload: Record<string, unknown> = {
        encoding_format: 'float',
        input: embeddingInput,
        model,
      };

      if (model.startsWith('text-embedding-3')) {
        payload.dimensions = dimensions;
      }

      const response = await axios.post<OpenAiEmbeddingResponse>(
        'https://api.openai.com/v1/embeddings',
        payload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const values = response.data.data?.[0]?.embedding;

      if (!values?.length) {
        throw new Error('OpenAI embedding response did not include a vector.');
      }

      return {
        dimensions: values.length,
        model: response.data.model ?? model,
        provider: 'openai',
        values,
      };
    } catch (error) {
      this.logger.warn(
        `OpenAI embedding failed; falling back to demo embedding. ${this.errorMessage(error)}`,
      );
      return this.createDemoEmbedding(text);
    }
  }

  private truncateEmbeddingInput(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length > MAX_EMBEDDING_INPUT_CHARS
      ? normalized.slice(0, MAX_EMBEDDING_INPUT_CHARS)
      : normalized;
  }

  private createDemoEmbedding(text: string): EmbeddingResult {
    return {
      dimensions: DEMO_EMBEDDING_DIMENSIONS,
      model: DEMO_EMBEDDING_MODEL,
      provider: 'demo',
      values: buildDemoEmbedding(text),
    };
  }

  private async searchContextRows(
    userId: string,
    queryEmbedding: number[],
    topK: number,
  ): Promise<RagSearchRow[]> {
    return this.dataSource.query<RagSearchRow[]>(
      `
        SELECT
          ed."sourceType",
          ed."sourceId",
          ed.content,
          ed.metadata,
          1 - (ed.embedding <=> $1::vector) AS similarity
        FROM "EmbeddingDocument" ed
        INNER JOIN "ArchivePost" post
          ON ed."sourceType" = 'ARCHIVE_POST'
          AND ed."sourceId" = post.id
        WHERE post."userId" = $2
          AND ed.embedding IS NOT NULL
        ORDER BY ed.embedding <=> $1::vector ASC
        LIMIT $3
      `,
      [toPgVectorLiteral(queryEmbedding), userId, topK],
    );
  }

  private async createAnalysis(
    searchRows: RagSearchRow[],
  ): Promise<RagAnalysisDraft> {
    const openAiAnalysis = await this.createOpenAiAnalysis(searchRows);
    return openAiAnalysis ?? this.createFallbackAnalysis(searchRows);
  }

  private async createOpenAiAnalysis(
    searchRows: RagSearchRow[],
  ): Promise<RagAnalysisDraft | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey || searchRows.length === 0) {
      return null;
    }

    try {
      const response = await axios.post<OpenAiChatCompletionResponse>(
        'https://api.openai.com/v1/chat/completions',
        {
          messages: [
            {
              content:
                'You analyze video game journal and review excerpts. Return concise JSON for a recommendation RAG context. Write playStyleSummary in polite formal Korean only, ending naturally with 합니다, 습니다, or 니다. Never use casual speech or 반말. Keep preferenceTags and wordCloud distinct: preferenceTags are enjoyed game elements such as genre, theme, mechanics, and presentation; wordCloud terms are player behavior/style patterns such as role, activity, pace, motivation, and social pattern.',
              role: 'system',
            },
            {
              content: this.analysisPrompt(searchRows),
              role: 'user',
            },
          ],
          model: this.config.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
          response_format: this.analysisJsonSchema(),
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        },
      );

      const content = response.data.choices?.[0]?.message?.content;

      if (!content) {
        return null;
      }

      return this.normalizeAnalysis(JSON.parse(content) as RagAnalysisDraft);
    } catch (error) {
      this.logger.warn(
        `OpenAI analysis failed; falling back to deterministic analysis. ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private analysisPrompt(searchRows: RagSearchRow[]): string {
    const sourceText = searchRows
      .map((row, index) =>
        [
          `SOURCE ${index + 1}`,
          `Title: ${row.metadata.title ?? 'Untitled'}`,
          `Game: ${row.metadata.gameTitle ?? 'Unknown'}`,
          `Similarity: ${Number(row.similarity).toFixed(4)}`,
          row.content,
        ].join('\n'),
      )
      .join('\n\n---\n\n');

    return [
      'Extract two different analysis layers.',
      '- preferenceTags: why positively rated/repeated games were enjoyable, for example STORY_RICH, CRAFTING, HORROR_ATMOSPHERE, COZY_SIM.',
      '- wordCloud: how the user tends to play, for example FARMING_LOOP, TANK_ROLE, AESTHETIC_EXPLORER, SOLO_PLANNER, COOP_TEAMPLAYER.',
      'Do not copy the same labels into both arrays unless the evidence truly names both a game feature and a play behavior.',
      'Write playStyleSummary as one polite formal Korean sentence. Do not use 반말, 해요체, or casual endings.',
      '',
      sourceText,
    ].join('\n');
  }

  private analysisJsonSchema() {
    return {
      json_schema: {
        name: 'gjc_rag_taste_analysis',
        schema: {
          additionalProperties: false,
          properties: {
            playStyleSummary: { type: 'string' },
            preferenceTags: {
              items: {
                additionalProperties: false,
                properties: {
                  label: { type: 'string' },
                  sourceCount: { type: 'number' },
                  weight: { type: 'number' },
                },
                required: ['label', 'weight', 'sourceCount'],
                type: 'object',
              },
              maxItems: 14,
              type: 'array',
            },
            wordCloud: {
              items: {
                additionalProperties: false,
                properties: {
                  category: {
                    enum: ['genre', 'mood', 'mechanic', 'pace', 'theme'],
                    type: 'string',
                  },
                  label: { type: 'string' },
                  sourceCount: { type: 'number' },
                  weight: { type: 'number' },
                },
                required: ['label', 'weight', 'sourceCount', 'category'],
                type: 'object',
              },
              maxItems: 18,
              type: 'array',
            },
          },
          required: ['preferenceTags', 'playStyleSummary', 'wordCloud'],
          type: 'object',
        },
        strict: true,
      },
      type: 'json_schema',
    };
  }

  private createFallbackAnalysis(searchRows: RagSearchRow[]): RagAnalysisDraft {
    const gameElementCandidates: Array<{
      category: AiWordCloudTerm['category'];
      label: string;
      terms: string[];
    }> = [
      {
        category: 'mechanic',
        label: 'TACTICAL_COMBAT',
        terms: ['tactical', 'turn-based', 'strategy', 'planning', 'board'],
      },
      {
        category: 'theme',
        label: 'STORY_DRIVEN',
        terms: ['story', 'narrative', 'dialogue', 'worldbuilding', 'choices'],
      },
      {
        category: 'mood',
        label: 'PIXEL_ART',
        terms: ['pixel', 'retro', 'screen language', 'readable'],
      },
      {
        category: 'mechanic',
        label: 'PUZZLE_SYSTEMS',
        terms: ['puzzle', 'rules', 'systems', 'logic', 'deduction'],
      },
      {
        category: 'mechanic',
        label: 'CRAFTING',
        terms: ['crafting', 'craft', 'item synthesis', 'gear', 'equipment'],
      },
      {
        category: 'mechanic',
        label: 'COLLECTION',
        terms: ['collection', 'collect', 'unlock', 'catalog', 'items'],
      },
      {
        category: 'mood',
        label: 'COZY_SIM',
        terms: ['cozy', 'relaxed', 'life sim', 'farming', 'routine'],
      },
      {
        category: 'theme',
        label: 'HORROR_ATMOSPHERE',
        terms: ['horror', 'dread', 'survival horror', 'limited resources'],
      },
      {
        category: 'mood',
        label: 'AESTHETIC_PRESENTATION',
        terms: ['art', 'music', 'atmosphere', 'visual', 'beautiful'],
      },
      {
        category: 'mechanic',
        label: 'DEDUCTION',
        terms: ['deduction', 'mystery', 'clue', 'case', 'observation'],
      },
      {
        category: 'mechanic',
        label: 'SPATIAL_REASONING',
        terms: ['spatial', 'space', 'position', 'perspective', 'portal'],
      },
      {
        category: 'mechanic',
        label: 'OPTIMIZATION',
        terms: ['optimization', 'efficient', 'factory', 'machine', 'automation'],
      },
      {
        category: 'theme',
        label: 'EUREKA_MOMENTS',
        terms: ['eureka', 'solution', 'aha', 'discover', 'secret'],
      },
    ];

    const playStyleCandidates: Array<{
      category: AiWordCloudTerm['category'];
      label: string;
      terms: string[];
    }> = [
      {
        category: 'pace',
        label: 'DELIBERATE_PLANNER',
        terms: ['planning', 'strategy', 'turn-based', 'deliberate', 'focus'],
      },
      {
        category: 'mechanic',
        label: 'SYSTEM_OPTIMIZER',
        terms: ['optimization', 'efficient', 'factory', 'automation', 'systems'],
      },
      {
        category: 'mechanic',
        label: 'FARMING_LOOP',
        terms: ['farming', 'grind', 'routine', 'harvest', 'repeat'],
      },
      {
        category: 'mechanic',
        label: 'HUNTING_LOOP',
        terms: ['hunt', 'boss', 'monster', 'pattern', 'gear progression'],
      },
      {
        category: 'theme',
        label: 'NARRATIVE_ROLEPLAYER',
        terms: ['roleplay', 'choice', 'story', 'social link', 'quest'],
      },
      {
        category: 'mood',
        label: 'AESTHETIC_EXPLORER',
        terms: ['art', 'atmosphere', 'music', 'world', 'exploration'],
      },
      {
        category: 'mechanic',
        label: 'COLLECTION_COMPLETIONIST',
        terms: ['collection', 'collect', 'unlock', 'catalog', 'achievement'],
      },
      {
        category: 'pace',
        label: 'LOW_PRESSURE_ROUTINE',
        terms: ['relaxed', 'cozy', 'low pressure', 'calm', 'routine'],
      },
      {
        category: 'mechanic',
        label: 'SOLO_PROBLEM_SOLVER',
        terms: ['solo', 'single player', 'puzzle', 'deduction', 'logic'],
      },
      {
        category: 'mechanic',
        label: 'COOP_TEAMPLAYER',
        terms: ['co-op', 'coop', 'team', 'voice', 'multiplayer'],
      },
      {
        category: 'mechanic',
        label: 'TANK_ROLE',
        terms: ['tank', 'defense', 'shield', 'frontline', 'aggro'],
      },
    ];

    const scoredGameElements = this.scoreAnalysisCandidates(
      searchRows,
      gameElementCandidates,
    );
    const scoredPlayStyles = this.scoreAnalysisCandidates(
      searchRows,
      playStyleCandidates,
    );

    const gameElementFallback =
      scoredGameElements.length > 0
        ? scoredGameElements
        : [
            {
              category: 'theme' as const,
              label: 'GAME_ELEMENTS',
              sourceCount: searchRows.length,
              terms: ['archive'],
              weight: 0.6,
            },
          ];
    const playStyleFallback =
      scoredPlayStyles.length > 0
        ? scoredPlayStyles
        : [
            {
              category: 'pace' as const,
              label: 'ARCHIVE_BASED_PLAYER',
              sourceCount: searchRows.length,
              terms: ['archive'],
              weight: 0.6,
            },
          ];

    // GJC-180: keep more granular tags so puzzle-heavy users do not collapse into one generic PUZZLE label.
    const preferenceTags = gameElementFallback.slice(0, 14).map((item) => ({
      label: item.label,
      sourceCount: item.sourceCount,
      weight: item.weight,
    }));

    const preferenceLabels = new Set(preferenceTags.map((tag) => tag.label));
    const wordCloud = playStyleFallback
      .filter((item) => !preferenceLabels.has(item.label))
      .slice(0, 18)
      .map((item) => ({
        category: item.category,
        label: item.label.replaceAll('_', ' '),
        sourceCount: item.sourceCount,
        weight: item.weight,
      }));

    return {
      playStyleSummary: this.fallbackSummary(wordCloud),
      preferenceTags,
      wordCloud,
    };
  }

  private scoreAnalysisCandidates(
    searchRows: RagSearchRow[],
    candidates: Array<{
      category: AiWordCloudTerm['category'];
      label: string;
      terms: string[];
    }>,
  ) {
    return candidates
      .map((candidate) => {
        const sourceCount = searchRows.filter((row) =>
          candidate.terms.some((term) =>
            `${row.content} ${row.metadata.title ?? ''} ${row.metadata.gameTitle ?? ''}`
              .toLowerCase()
              .includes(term),
          ),
        ).length;

        return {
          ...candidate,
          sourceCount,
          weight: Number(Math.min(0.98, 0.55 + sourceCount * 0.13).toFixed(2)),
        };
      })
      .filter((candidate) => candidate.sourceCount > 0)
      .sort((left, right) => right.weight - left.weight);
  }

  private fallbackSummary(styles: AiWordCloudTerm[]): string {
    const labels = styles
      .slice(0, 3)
      .map((style) => style.label.replaceAll('_', ' '));

    if (labels.length === 0) {
      return '아직 분석할 기록이 부족하므로 더 많은 저널이나 리뷰가 쌓이면 추천 정확도가 높아집니다.';
    }

    return `이 플레이어는 ${labels.join(', ').toLowerCase()} 플레이 성향이 강하며, 추천은 게임 요소 태그와 별도로 사용자의 행동 패턴과 기록 맥락을 함께 반영합니다.`;
  }

  private normalizeAnalysis(analysis: RagAnalysisDraft): RagAnalysisDraft {
    const preferenceTags = Array.isArray(analysis.preferenceTags)
      ? analysis.preferenceTags.slice(0, 14)
      : [];
    const preferenceLabels = new Set(
      preferenceTags.map((tag) => this.normalizeAnalysisLabel(tag.label)),
    );
    const wordCloud = Array.isArray(analysis.wordCloud)
      ? analysis.wordCloud
          .filter(
            (term) =>
              !preferenceLabels.has(this.normalizeAnalysisLabel(term.label)),
          )
          .slice(0, 18)
      : [];

    return {
      playStyleSummary:
        typeof analysis.playStyleSummary === 'string'
          ? analysis.playStyleSummary
          : 'The available sources describe a focused player profile.',
      preferenceTags,
      wordCloud,
    };
  }

  private normalizeAnalysisLabel(label: string): string {
    return label.trim().replaceAll(' ', '_').toUpperCase();
  }

  private toContextSource(row: RagSearchRow): AiRagContextSource {
    return {
      excerpt: this.excerpt(row.content),
      gameTitle: row.metadata.gameTitle ?? null,
      similarity: Number(Number(row.similarity).toFixed(4)),
      sourceId: row.sourceId,
      sourceType: row.sourceType as AiRagContextSource['sourceType'],
      title: row.metadata.title ?? 'Untitled source',
    };
  }

  private toUserGameContextRow(game: UserGameRow): RagSearchRow {
    return {
      content: [
        `Steam/UserGame play record for ${game.gameTitle}.`,
        `Total playtime minutes: ${game.totalPlaytimeMinutes}.`,
        `Recent playtime minutes: ${game.recentPlaytimeMinutes}.`,
        `Achievement rate: ${game.achievementRate ?? 'unknown'}.`,
        `Genres: ${game.gameGenres.join(', ')}.`,
        `Tags: ${game.gameTags.join(', ')}.`,
      ].join('\n'),
      metadata: {
        gameTitle: game.gameTitle,
        title: `${game.gameTitle} play record`,
      },
      similarity: 1,
      sourceId: game.gameId,
      sourceType: 'GAME',
    };
  }

  private excerpt(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    return normalized.length > 220
      ? `${normalized.slice(0, 217).trim()}...`
      : normalized;
  }

  private errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const apiMessage = (
        error.response?.data as
          | { error?: { message?: string } }
          | undefined
      )?.error?.message;
      const message = apiMessage ?? error.message;

      return status ? `HTTP ${status}: ${message}` : message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
