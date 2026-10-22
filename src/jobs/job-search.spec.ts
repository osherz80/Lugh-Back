import {
  RAW_COSINE_FLOOR,
  RERANK_FLOOR,
  buildSearchPool,
  capByRerankFloor,
  sectionWeight,
  shouldRunHyde,
  textSearchConfig,
  tierRankedJobs,
  titleMatchesQuery,
} from './job-search';

describe('titleMatchesQuery', () => {
  it('matches a title token and misses a longer word that only shares a prefix', () => {
    expect(titleMatchesQuery('Senior React Engineer', 'React')).toBe(true);
    expect(titleMatchesQuery('Reaction Specialist', 'React')).toBe(false);
  });

  it('treats hyphens as spaces for a phrase match', () => {
    expect(titleMatchesQuery('Full-Stack Engineer', 'full stack')).toBe(true);
  });

  it('matches a spaceless query against adjacent title tokens only', () => {
    expect(titleMatchesQuery('Full-Stack Engineer', 'fullstack')).toBe(true);
    expect(titleMatchesQuery('Senior React Engineer', 'fullstack')).toBe(false);
  });
});

describe('shouldRunHyde', () => {
  it('runs HyDE for a short query when no title contains it', () => {
    expect(shouldRunHyde('nurse', ['Civil Engineer'])).toBe(true);
  });

  it('skips HyDE when a short query matches a title', () => {
    expect(shouldRunHyde('React', ['Senior React Engineer'])).toBe(false);
    expect(shouldRunHyde('full stack', ['Full-Stack Engineer'])).toBe(false);
    expect(shouldRunHyde('fullstack', ['Full Stack Engineer'])).toBe(false);
  });

  it('skips HyDE once the trimmed query is 20 characters or longer', () => {
    const query =
      'full stack engineer that know how to scale production environments';
    expect(query.trim().length).toBeGreaterThanOrEqual(20);
    expect(shouldRunHyde(query, ['Accountant'])).toBe(false);
  });
});

describe('textSearchConfig', () => {
  it('defaults to simple and lowercases a caller-supplied config name', () => {
    expect(textSearchConfig()).toBe('simple');
    expect(textSearchConfig('English')).toBe('english');
  });

  it('rejects a config name that is not a Postgres identifier', () => {
    expect(() => textSearchConfig("english'; drop table jobs")).toThrow(
      /text search configuration/,
    );
  });
});

describe('search thresholds', () => {
  it('starts from the named cosine and rerank floors', () => {
    expect(RAW_COSINE_FLOOR).toBe(0.35);
    expect(RERANK_FLOOR).toBe(0.2);
  });
});

describe('sectionWeight', () => {
  it('stores the field weights used at retrieval time', () => {
    expect(sectionWeight('title')).toBe(2.2);
    expect(sectionWeight('requirements')).toBe(1.8);
    expect(sectionWeight('niceToHave')).toBe(1.4);
    expect(sectionWeight('responsibilities')).toBe(1);
    expect(sectionWeight('description')).toBe(0.8);
    expect(sectionWeight('aboutCompany')).toBe(0.3);
    expect(sectionWeight('benefits')).toBe(1);
  });
});

describe('buildSearchPool', () => {
  it('keeps a title hit that missed the vector top 30', () => {
    const pool = buildSearchPool(
      [{ id: 'vector-job', score: 0.9 }],
      [],
      ['title-job'],
    );

    expect(pool).toContain('title-job');
    expect(pool).toContain('vector-job');
  });

  it('keeps every title hit and fills the rest from the best vector scores up to 40', () => {
    const vectorHits = Array.from({ length: 30 }, (_, index) => ({
      id: `vector-${index}`,
      score: 30 - index,
    }));
    const keywordHits = Array.from({ length: 20 }, (_, index) => ({
      id: `keyword-${index}`,
      rank: 20 - index,
    }));
    const titleHitIds = ['title-outside', 'vector-10'];

    const pool = buildSearchPool(vectorHits, keywordHits, titleHitIds);

    expect(pool.slice(0, 2)).toEqual(['title-outside', 'vector-10']);
    expect(pool.filter((id) => id.startsWith('vector-'))).toHaveLength(30);
    expect(pool).not.toContain('keyword-0');
  });

  it('fills from the best vector scores until 40 when title hits leave room', () => {
    const vectorHits = Array.from({ length: 30 }, (_, index) => ({
      id: `vector-${index}`,
      score: 100 - index,
    }));
    const extraVectorHits = Array.from({ length: 15 }, (_, index) => ({
      id: `extra-${index}`,
      score: 50 - index,
    }));
    const pool = buildSearchPool(
      [...vectorHits, ...extraVectorHits],
      Array.from({ length: 20 }, (_, index) => ({
        id: `keyword-${index}`,
        rank: index,
      })),
      ['title-outside'],
    );

    expect(pool).toHaveLength(40);
    expect(pool[0]).toBe('title-outside');
    expect(pool).toContain('vector-0');
    expect(pool).not.toContain('keyword-0');
  });

  it('keeps title hits even when they already exceed 40', () => {
    const titleHitIds = Array.from(
      { length: 45 },
      (_, index) => `title-${index}`,
    );
    const pool = buildSearchPool(
      [{ id: 'vector-job', score: 1 }],
      [],
      titleHitIds,
    );

    expect(pool).toHaveLength(45);
    expect(pool).not.toContain('vector-job');
  });
});

describe('tierRankedJobs', () => {
  const row = (id: string, rerankScore: number) => ({ id, rerankScore });

  it('returns title hits first, then other jobs at or above the rerank floor, stopped at 10', () => {
    const jobs = [
      row('weak-title', 0.05),
      row('strong-other', 0.99),
      row('below-floor', RERANK_FLOOR - 0.01),
      row('strong-title', 0.4),
      row('floor', RERANK_FLOOR),
    ];

    expect(
      tierRankedJobs(jobs, new Set(['weak-title', 'strong-title'])),
    ).toEqual([
      row('strong-title', 0.4),
      row('weak-title', 0.05),
      row('strong-other', 0.99),
      row('floor', RERANK_FLOOR),
    ]);
  });

  it('stops after 10 jobs', () => {
    const jobs = Array.from({ length: 12 }, (_, index) =>
      row(`job-${index}`, 1 - index / 100),
    );
    const titleHits = new Set(jobs.map((job) => job.id));

    expect(tierRankedJobs(jobs, titleHits)).toHaveLength(10);
  });
});

describe('capByRerankFloor', () => {
  it('drops CV hits below the rerank floor and stops at 10', () => {
    const hits = Array.from({ length: 12 }, (_, index) => ({
      id: `cv-${index}`,
      rerankScore: index === 11 ? RAW_COSINE_FLOOR : 1 - index / 100,
    }));
    hits.push({ id: 'weak', rerankScore: RERANK_FLOOR - 0.01 });

    const capped = capByRerankFloor(hits);

    expect(capped).toHaveLength(10);
    expect(capped.some((hit) => hit.id === 'weak')).toBe(false);
    expect(capped[0].id).toBe('cv-0');
  });
});
