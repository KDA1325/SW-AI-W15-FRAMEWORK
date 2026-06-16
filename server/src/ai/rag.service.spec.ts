import { RagService } from './rag.service';

describe('RagService taste analysis fallback', () => {
  it('separates play-style terms from enjoyed game element tags', () => {
    const service = new RagService(
      { query: jest.fn(), getRepository: jest.fn() } as never,
      { get: jest.fn() } as never,
    );
    const analysis = (
      service as unknown as {
        createFallbackAnalysis: (rows: unknown[]) => {
          preferenceTags: Array<{ label: string }>;
          wordCloud: Array<{ label: string }>;
        };
      }
    ).createFallbackAnalysis([
      {
        content:
          'Post type: REVIEW\nGame: Monster Hunter: World\nContent: I like hunting monsters, reading boss patterns, crafting gear, and repeating the farming loop.\nRating: 4.5\nTags: Crafting, Boss Hunt, Gear Progression',
        metadata: {
          gameTitle: 'Monster Hunter: World',
          title: 'Gear farming feels good',
        },
        similarity: 0.94,
        sourceId: 'post-1',
        sourceType: 'ARCHIVE_POST',
      },
      {
        content:
          'Post type: JOURNAL\nGame: Journey\nContent: The art, music, atmosphere, and exploration made me play slowly as an aesthetic explorer.\nTags: Atmospheric, Exploration',
        metadata: {
          gameTitle: 'Journey',
          title: 'Quiet exploration',
        },
        similarity: 0.9,
        sourceId: 'post-2',
        sourceType: 'ARCHIVE_POST',
      },
    ]);

    const preferenceLabels = analysis.preferenceTags.map((tag) => tag.label);
    const styleLabels = analysis.wordCloud.map((term) =>
      term.label.replaceAll(' ', '_'),
    );

    expect(preferenceLabels).toEqual(
      expect.arrayContaining(['CRAFTING', 'AESTHETIC_PRESENTATION']),
    );
    expect(styleLabels).toEqual(
      expect.arrayContaining(['HUNTING_LOOP', 'AESTHETIC_EXPLORER']),
    );
    expect(styleLabels.some((label) => preferenceLabels.includes(label))).toBe(
      false,
    );
  });
});
