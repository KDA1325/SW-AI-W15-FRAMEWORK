import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AiAgentStoppedReason,
  AiRecommendationCard,
  AiRecommendationSyncResponse,
  AiRagAnalysisResponse,
} from './recommendation-contract';
import { AiProfile } from '../auth/entities/aiProfile.entity';
import { McpService } from './mcp.service';
import { RagService } from './rag.service';

const DEFAULT_AGENT_MAX_ITERATIONS = 4;
const DEFAULT_AGENT_TIMEOUT_MS = 30_000;
const MIN_RECOMMENDATION_COUNT = 3;
const MAX_RECOMMENDATIONS_PER_SERIES = 1;

type AgentSyncOptions = {
  forceRefresh?: boolean;
  requestId?: string;
  topK?: number;
};

type AgentToolResult = {
  error: string | null;
  errorCode: string | null;
  games: Array<{
    aliases?: string[];
    externalId: {
      id: string;
      provider: 'igdb';
    };
    genres: string[];
    imageUrl: string | null;
    platforms: string[];
    releaseDate: string | null;
    sourceUrl: string | null;
    summary: string | null;
    tags: string[];
    title: string;
  }>;
  provider: 'igdb';
  query: string;
};

type McpToolCallSuccess = {
  result?: {
    structuredContent?: Omit<AgentToolResult, 'query'>;
  };
};

type AgentState = {
  exclusionSet: RecommendationExclusionSet;
  maxIterations: number;
  recommendations: AiRecommendationCard[];
  startedAt: number;
  toolResults: AgentToolResult[];
  userId: string;
};

type LocalGameRow = {
  genres: string[];
  id: string;
  imageUrl: string | null;
  platforms: string[];
  signalScore: number | string;
  steamAppId: string | null;
  tags: string[];
  title: string;
};

type RecommendationExclusionRow = {
  gameId: string | null;
  igdbId: string | null;
  steamAppId: string | null;
  title: string;
};

type RecommendationExclusionSet = {
  externalIds: Set<string>;
  gameIds: Set<string>;
  titles: Set<string>;
};

@Injectable()
export class AgentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mcpService: McpService,
    private readonly ragService: RagService,
  ) {}

  async syncRecommendations(
    userId: string,
    options: AgentSyncOptions = {},
  ): Promise<AiRecommendationSyncResponse> {
    const requestId = options.requestId ?? `gjc-sync-${Date.now()}`;
    const ragContext = await this.ragService.analyzeForUser(userId, {
      refreshEmbeddings: options.forceRefresh !== false,
      topK: options.topK,
    });
    const exclusionSet = await this.loadRecommendationExclusionSet(userId);
    const state: AgentState = {
      exclusionSet,
      maxIterations: this.maxIterations(),
      recommendations: [],
      startedAt: Date.now(),
      toolResults: [],
      userId,
    };
    let usedFallback = false;

    for (const query of this.buildSearchQueries(ragContext)) {
      if (this.shouldStop(state)) {
        break;
      }

      const toolResult = await this.callSearchGamesTool(query, ragContext);
      state.toolResults.push(toolResult);
      state.recommendations.push(
        ...this.toRecommendations(toolResult, ragContext, state),
      );
      state.recommendations = this.uniqueRecommendations(state.recommendations);

      if (state.recommendations.length >= MIN_RECOMMENDATION_COUNT) {
        break;
      }
    }

    if (state.recommendations.length < MIN_RECOMMENDATION_COUNT) {
      usedFallback = true;
      state.recommendations = this.uniqueRecommendations([
        ...state.recommendations,
        ...(await this.fallbackRecommendations(ragContext, state)),
      ]);
    }

    const stoppedReason: AiAgentStoppedReason = usedFallback
      ? 'fallback'
      : state.recommendations.length >= MIN_RECOMMENDATION_COUNT
        ? 'completed'
        : this.timedOut(state)
          ? 'timeout'
          : state.toolResults.length >= state.maxIterations
            ? 'max_iterations'
            : 'fallback';

    const now = new Date().toISOString();

    const response: AiRecommendationSyncResponse = {
      requestId,
      userId,
      generatedAt: now,
      lastSyncAt: now,
      preferenceTags: ragContext.preferenceTags,
      playStyleSummary: ragContext.playStyleSummary,
      wordCloud: ragContext.wordCloud,
      recommendations: state.recommendations
        .slice(0, MIN_RECOMMENDATION_COUNT)
        .map((recommendation, index) => ({
          ...recommendation,
          rank: index + 1,
        })),
      contextSources: ragContext.contextSources,
      pipeline: {
        agent: {
          iterations: state.toolResults.length,
          maxIterations: state.maxIterations,
          stoppedReason,
        },
        mcp: {
          provider: 'igdb',
          resultCount: state.toolResults.reduce(
            (sum, result) => sum + result.games.length,
            0,
          ),
          toolName: 'search_games',
        },
        rag: {
          sourceCount: ragContext.contextSources.length,
          topK: options.topK ?? ragContext.contextSources.length,
        },
      },
    };

    await this.saveLatestRecommendationSync(userId, response);

    return response;
  }

  async getLatestRecommendations(
    userId: string,
  ): Promise<AiRecommendationSyncResponse | null> {
    const profile = await this.dataSource.getRepository(AiProfile).findOne({
      where: { userId },
    });

    return profile?.lastRecommendationSync ?? null;
  }

  private buildSearchQueries(ragContext: AiRagAnalysisResponse): string[] {
    const tagQueries = ragContext.preferenceTags
      .slice(0, 3)
      .map((tag) => tag.label.replaceAll('_', ' '));
    const sourceQueries = ragContext.contextSources
      .map((source) => source.gameTitle)
      .filter((title): title is string => Boolean(title))
      .filter(
        (title) =>
          !this.isExcludedTitle(title, this.buildTitleExclusionSet(ragContext)),
      );

    // The loop treats each query as a function-calling decision: inspect state, call search_games, merge results.
    return [...new Set([...sourceQueries, ...tagQueries, 'story rich RPG'])];
  }

  private async callSearchGamesTool(
    query: string,
    ragContext: AiRagAnalysisResponse,
  ): Promise<AgentToolResult> {
    const response = await this.mcpService.handle({
      id: query,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: {
          limit: 5,
          preferenceTags: ragContext.preferenceTags.map((tag) => tag.label),
          query,
        },
        name: 'search_games',
      },
    });

    const structuredContent = this.isMcpToolCallSuccess(response)
      ? response.result?.structuredContent
      : undefined;

    return {
      error: structuredContent?.error ?? 'MCP search_games returned no result.',
      errorCode: structuredContent?.errorCode ?? 'external_api_error',
      games: structuredContent?.games ?? [],
      provider: 'igdb',
      query,
    };
  }

  private toRecommendations(
    toolResult: AgentToolResult,
    ragContext: AiRagAnalysisResponse,
    state: AgentState,
  ): AiRecommendationCard[] {
    const matchedTags = ragContext.preferenceTags
      .slice(0, 4)
      .map((tag) => tag.label);

    return toolResult.games
      .filter((game) => this.isRecommendationCandidate(game, toolResult.query, state))
      .map((game, index) => {
        const candidateTags = this.tagsSupportedByCandidate(matchedTags, game);

        return {
          externalId: game.externalId,
          gameId: null,
          genres: game.genres,
          imageUrl: game.imageUrl,
          matchedTags: candidateTags,
          matchScore: Number(
            Math.max(
              0.72,
              0.94 - (state.recommendations.length + index) * 0.04,
            ).toFixed(2),
          ),
          platforms: game.platforms,
          rank: state.recommendations.length + index + 1,
          reason: this.recommendationReason(
            game.title,
            candidateTags,
            toolResult.query,
          ),
          sourceUrl: game.sourceUrl,
          tags: game.tags,
          title: game.title,
        };
      });
  }

  private isMcpToolCallSuccess(
    response: unknown,
  ): response is McpToolCallSuccess {
    return (
      response !== null && typeof response === 'object' && 'result' in response
    );
  }

  private async fallbackRecommendations(
    ragContext: AiRagAnalysisResponse,
    state: AgentState,
  ): Promise<AiRecommendationCard[]> {
    const localGames = await this.loadUserScopedLocalGames(state.userId);
    const matchedTags = ragContext.preferenceTags
      .slice(0, 4)
      .map((tag) => tag.label);

    return localGames
      .filter((game) => !this.isExcludedLocalGame(game, state.exclusionSet))
      .map((game, index) => {
      const signalScore = Number(game.signalScore);
      const candidateTags = this.tagsSupportedByCandidate(matchedTags, {
        genres: game.genres,
        summary: null,
        tags: game.tags,
        title: game.title,
      });

      return {
        externalId: {
          id: game.steamAppId ?? game.id,
          provider: game.steamAppId ? 'steam' : 'igdb',
        },
        gameId: game.id,
        genres: game.genres,
        imageUrl: game.imageUrl,
        matchedTags: candidateTags,
        matchScore: Number(
          Math.min(
            0.92,
            Math.max(0.68, 0.7 + signalScore * 0.04 - index * 0.02),
          ).toFixed(2),
        ),
        platforms: game.platforms,
        rank: state.recommendations.length + index + 1,
        reason:
          `Fallback recommendation from this user's own journal, review, and Steam play signals. ` +
          this.recommendationReason(game.title, candidateTags, game.title),
        sourceUrl: game.steamAppId
          ? `https://store.steampowered.com/app/${game.steamAppId}`
          : null,
        tags: game.tags,
        title: game.title,
      };
    });
  }

  private async loadUserScopedLocalGames(
    userId: string,
  ): Promise<LocalGameRow[]> {
    return this.dataSource.query<LocalGameRow[]>(
      `
        WITH user_signal_terms AS (
          SELECT array_agg(DISTINCT lower(signal.term)) AS terms
          FROM (
            SELECT unnest(game.tags || game.genres || game.platforms) AS term
            FROM "ArchivePost" post
            INNER JOIN "Game" game ON game.id = post."gameId"
            WHERE post."userId" = $1

            UNION

            SELECT unnest(game.tags || game.genres || game.platforms) AS term
            FROM "UserGame" user_game
            INNER JOIN "Game" game ON game.id = user_game."gameId"
            WHERE user_game."userId" = $1
          ) signal
        )
        SELECT
          game.id,
          game.title,
          game."imageUrl",
          game.genres,
          game.platforms,
          game.tags,
          game."steamAppId",
          COALESCE((
            SELECT count(*)
            FROM unnest(game.tags || game.genres || game.platforms) AS candidate(term)
            WHERE lower(candidate.term) = ANY(COALESCE(signals.terms, ARRAY[]::text[]))
          ), 0)::int AS "signalScore"
        FROM "Game" game
        CROSS JOIN user_signal_terms signals
        WHERE COALESCE(array_length(signals.terms, 1), 0) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM "ArchivePost" played_post
            WHERE played_post."userId" = $1
              AND played_post."gameId" = game.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "UserGame" played_game
            WHERE played_game."userId" = $1
              AND played_game."gameId" = game.id
          )
          AND EXISTS (
            SELECT 1
            FROM unnest(game.tags || game.genres || game.platforms) AS candidate(term)
            WHERE lower(candidate.term) = ANY(signals.terms)
          )
        ORDER BY "signalScore" DESC, game."updatedAt" DESC
        LIMIT 10
      `,
      [userId],
    );
  }

  private async loadRecommendationExclusionSet(
    userId: string,
  ): Promise<RecommendationExclusionSet> {
    const rows = await this.dataSource.query<RecommendationExclusionRow[]>(
      `
        SELECT DISTINCT
          game.id AS "gameId",
          game."igdbId",
          game."steamAppId",
          game.title
        FROM "Game" game
        WHERE EXISTS (
            SELECT 1
            FROM "ArchivePost" post
            WHERE post."userId" = $1
              AND post."gameId" = game.id
          )
          OR EXISTS (
            SELECT 1
            FROM "UserGame" user_game
            WHERE user_game."userId" = $1
              AND user_game."gameId" = game.id
          )
      `,
      [userId],
    );

    return {
      externalIds: new Set(
        rows.flatMap((row) => [
          row.igdbId ? `igdb:${row.igdbId}` : null,
          row.steamAppId ? `steam:${row.steamAppId}` : null,
        ]).filter((value): value is string => Boolean(value)),
      ),
      gameIds: new Set(
        rows.map((row) => row.gameId).filter((value): value is string => Boolean(value)),
      ),
      titles: new Set(rows.map((row) => this.normalizeTitle(row.title))),
    };
  }

  private async saveLatestRecommendationSync(
    userId: string,
    response: AiRecommendationSyncResponse,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(AiProfile);
    let profile = await repository.findOne({ where: { userId } });

    if (!profile) {
      profile = repository.create({ userId });
    }

    // The page reload path reads this exact snapshot, so only an explicit SYNC click changes what React displays.
    profile.lastRecommendationSync = response;
    profile.playStyleSummary = response.playStyleSummary;
    profile.favoriteKeywords = response.preferenceTags.map((tag) => tag.label);
    profile.favoriteGenres = response.wordCloud
      .filter((term) => term.category === 'genre')
      .map((term) => term.label);
    profile.lastAnalyzedAt = new Date(response.generatedAt);

    await repository.save(profile);
  }

  private recommendationReason(
    title: string,
    matchedTags: string[],
    query: string,
  ): string {
    const tags =
      matchedTags.length > 0
        ? matchedTags.join(', ')
        : 'the available RAG context';

    return `${title} matches the search signal "${query}" and the player's RAG tags: ${tags}.`;
  }

  private uniqueRecommendations(
    recommendations: AiRecommendationCard[],
  ): AiRecommendationCard[] {
    const seen = new Set<string>();
    const seriesCounts = new Map<string, number>();
    const unique: AiRecommendationCard[] = [];

    for (const recommendation of recommendations) {
      const key = this.normalizeTitle(recommendation.title);
      const seriesKey = this.seriesKey(recommendation.title);

      if (seen.has(key)) {
        continue;
      }

      if (
        (seriesCounts.get(seriesKey) ?? 0) >= MAX_RECOMMENDATIONS_PER_SERIES
      ) {
        continue;
      }

      seen.add(key);
      seriesCounts.set(seriesKey, (seriesCounts.get(seriesKey) ?? 0) + 1);
      unique.push(recommendation);
    }

    return unique;
  }

  private isRecommendationCandidate(
    game: AgentToolResult['games'][number],
    query: string,
    state: AgentState,
  ) {
    if (this.isExcludedExternalGame(game, state.exclusionSet)) {
      return false;
    }

    return this.hasReliableCandidateMatch(game, query);
  }

  private isExcludedExternalGame(
    game: AgentToolResult['games'][number],
    exclusionSet: RecommendationExclusionSet,
  ) {
    return (
      exclusionSet.externalIds.has(
        `${game.externalId.provider}:${game.externalId.id}`,
      ) || exclusionSet.titles.has(this.normalizeTitle(game.title))
    );
  }

  private isExcludedLocalGame(
    game: LocalGameRow,
    exclusionSet: RecommendationExclusionSet,
  ) {
    return (
      exclusionSet.gameIds.has(game.id) ||
      exclusionSet.titles.has(this.normalizeTitle(game.title)) ||
      Boolean(
        game.steamAppId &&
          exclusionSet.externalIds.has(`steam:${game.steamAppId}`),
      )
    );
  }

  private hasReliableCandidateMatch(
    game: AgentToolResult['games'][number],
    query: string,
  ) {
    const normalizedQuery = this.normalizeTitle(query);
    const normalizedTitle = this.normalizeTitle(game.title);
    const normalizedAliases = (game.aliases ?? []).map((alias) =>
      this.normalizeTitle(alias),
    );
    const sourceSlug = game.sourceUrl?.split('/').pop()?.replaceAll('-', ' ');
    const normalizedSlug = this.normalizeTitle(sourceSlug ?? '');

    // GJC-181: 제목 검색은 이름을 검증하고, 태그 검색은 후보 메타데이터가 그 태그를 설명해야 한다.
    return (
      normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle) ||
      normalizedAliases.some(
        (alias) =>
          alias.includes(normalizedQuery) || normalizedQuery.includes(alias),
      ) ||
      Boolean(
        normalizedSlug &&
          (normalizedSlug.includes(normalizedQuery) ||
            normalizedQuery.includes(normalizedSlug)),
      ) ||
      this.querySupportedByCandidate(query, game)
    );
  }

  private querySupportedByCandidate(
    query: string,
    game: Pick<
      AgentToolResult['games'][number],
      'genres' | 'summary' | 'tags' | 'title'
    >,
  ) {
    const searchableText = [
      game.title,
      game.summary,
      ...game.genres,
      ...game.tags,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase();

    return query
      .toLowerCase()
      .split(/[_\s-]+/)
      .filter((part) => part.length >= 4)
      .some((part) => searchableText.includes(part));
  }

  private tagsSupportedByCandidate(
    matchedTags: string[],
    game: Pick<
      AgentToolResult['games'][number],
      'genres' | 'summary' | 'tags' | 'title'
    >,
  ) {
    const searchableText = [
      game.title,
      game.summary,
      ...game.genres,
      ...game.tags,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase();

    return matchedTags.filter((tag) =>
      tag
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter((part) => part.length >= 4)
        .some((part) => searchableText.includes(part)),
    );
  }

  private buildTitleExclusionSet(ragContext: AiRagAnalysisResponse) {
    return new Set(
      ragContext.contextSources
        .map((source) => source.gameTitle)
        .filter((title): title is string => Boolean(title))
        .map((title) => this.normalizeTitle(title)),
    );
  }

  private isExcludedTitle(title: string, titles: Set<string>) {
    return titles.has(this.normalizeTitle(title));
  }

  private normalizeTitle(title: string) {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private seriesKey(title: string) {
    return this.normalizeTitle(title)
      .replace(/\b[ivx]+\b$/i, '')
      .replace(/\b\d+\b$/i, '')
      .split(/[:\-]/)[0]
      .trim();
  }

  private maxIterations(): number {
    const rawValue = Number(this.config.get<string>('AGENT_MAX_ITERATIONS'));
    return Number.isInteger(rawValue) && rawValue > 0
      ? rawValue
      : DEFAULT_AGENT_MAX_ITERATIONS;
  }

  private timeoutMs(): number {
    const rawValue = Number(this.config.get<string>('AGENT_TIMEOUT_MS'));
    return Number.isInteger(rawValue) && rawValue > 0
      ? rawValue
      : DEFAULT_AGENT_TIMEOUT_MS;
  }

  private shouldStop(state: AgentState): boolean {
    return (
      state.toolResults.length >= state.maxIterations || this.timedOut(state)
    );
  }

  private timedOut(state: AgentState): boolean {
    return Date.now() - state.startedAt > this.timeoutMs();
  }
}
