import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type ExternalApiErrorCode =
  | 'missing_credentials'
  | 'unauthorized'
  | 'rate_limited'
  | 'network_error'
  | 'external_api_error';

type IgdbToken = {
  accessToken: string;
  expiresAt: number;
};

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type IgdbGameRow = {
  alternative_names?: Array<{ name?: string }>;
  cover?: {
    image_id?: string;
    url?: string;
  };
  first_release_date?: number;
  genres?: Array<{ name?: string }>;
  id: number;
  name: string;
  platforms?: Array<{ name?: string }>;
  slug?: string;
  summary?: string;
  themes?: Array<{ name?: string }>;
  total_rating?: number;
};

export type SearchGamesInput = {
  limit?: number;
  preferenceTags?: string[];
  query: string;
};

export type SearchGamesResult = {
  error: string | null;
  errorCode: ExternalApiErrorCode | null;
  games: Array<{
    aliases: string[];
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
    totalRating: number | null;
  }>;
  provider: 'igdb';
};

@Injectable()
export class IgdbService {
  private token: IgdbToken | null = null;

  constructor(private readonly config: ConfigService) {}

  async searchGames(input: SearchGamesInput): Promise<SearchGamesResult> {
    const clientId = this.config.get<string>('IGDB_CLIENT_ID');
    const clientSecret = this.config.get<string>('IGDB_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return {
        error:
          'IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.',
        errorCode: 'missing_credentials',
        games: [],
        provider: 'igdb',
      };
    }

    try {
      const token = await this.getAccessToken(clientId, clientSecret);
      const response = await axios.post<IgdbGameRow[]>(
        'https://api.igdb.com/v4/games',
        this.buildGamesQuery(input),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Client-ID': clientId,
            'Content-Type': 'text/plain',
          },
          timeout: 15000,
        },
      );

      return {
        error: null,
        errorCode: null,
        games: response.data.map((game) => this.toGameResult(game)),
        provider: 'igdb',
      };
    } catch (error) {
      return {
        ...this.toSafeExternalApiError(error),
        games: [],
        provider: 'igdb',
      };
    }
  }

  private async getAccessToken(
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const now = Date.now();

    if (this.token && this.token.expiresAt > now + 60_000) {
      return this.token.accessToken;
    }

    const response = await axios.post<TwitchTokenResponse>(
      'https://id.twitch.tv/oauth2/token',
      null,
      {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        },
        timeout: 15000,
      },
    );

    this.token = {
      accessToken: response.data.access_token,
      expiresAt: now + response.data.expires_in * 1000,
    };

    return this.token.accessToken;
  }

  private buildGamesQuery(input: SearchGamesInput): string {
    const limit = this.normalizeLimit(input.limit);
    const search = this.escapeSearch(input.query);

    // IGDB uses APICalypse syntax: a plain-text query body with fields/search/where/limit clauses.
    return [
      'fields name,slug,summary,first_release_date,total_rating,alternative_names.name,cover.image_id,genres.name,platforms.name,themes.name;',
      `search "${search}";`,
      'where version_parent = null;',
      `limit ${limit};`,
    ].join('\n');
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || !Number.isInteger(limit)) {
      return 5;
    }

    return Math.min(Math.max(limit, 1), 10);
  }

  private escapeSearch(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim();
  }

  private toGameResult(game: IgdbGameRow): SearchGamesResult['games'][number] {
    const slug = game.slug ?? this.slugify(game.name);

    return {
      aliases: this.names(game.alternative_names).slice(0, 3),
      externalId: {
        id: String(game.id),
        provider: 'igdb',
      },
      genres: this.names(game.genres),
      imageUrl: game.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
        : null,
      platforms: this.names(game.platforms),
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
        : null,
      sourceUrl: slug ? `https://www.igdb.com/games/${slug}` : null,
      summary: game.summary ?? null,
      // GJC-180: themes alone are sparse, so tags also include genres for downstream taste analysis.
      tags: [...new Set([...this.names(game.themes), ...this.names(game.genres)])],
      title: game.name,
      totalRating: game.total_rating ?? null,
    };
  }

  private names(values?: Array<{ name?: string }>): string[] {
    return (
      values
        ?.map((value) => value.name)
        .filter((value): value is string => Boolean(value)) ?? []
    );
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toSafeExternalApiError(error: unknown): {
    error: string;
    errorCode: ExternalApiErrorCode;
  } {
    if (!axios.isAxiosError(error)) {
      return {
        error: 'IGDB request failed before a response was returned.',
        errorCode: 'external_api_error',
      };
    }

    const status = error.response?.status;

    if (status === 401 || status === 403) {
      return {
        error:
          'IGDB authorization failed. Check IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.',
        errorCode: 'unauthorized',
      };
    }

    if (status === 429) {
      return {
        error: 'IGDB rate limit was exceeded. Retry later or reduce requests.',
        errorCode: 'rate_limited',
      };
    }

    if (!error.response) {
      return {
        error: 'IGDB network request failed or timed out.',
        errorCode: 'network_error',
      };
    }

    return {
      error: `IGDB returned HTTP ${status ?? 'unknown'} while searching games.`,
      errorCode: 'external_api_error',
    };
  }
}
