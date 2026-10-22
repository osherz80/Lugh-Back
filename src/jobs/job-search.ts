export const RAW_COSINE_FLOOR = 0.35;
export const RERANK_FLOOR = 0.2;
export const VECTOR_CANDIDATE_LIMIT = 30;
export const KEYWORD_CANDIDATE_LIMIT = 30;
export const MERGE_POOL_LIMIT = 40;
export const RESULT_LIMIT = 10;
export const HYDE_QUERY_LENGTH_LIMIT = 20;

const SECTION_WEIGHTS: Record<string, number> = {
  title: 2.2,
  requirements: 1.8,
  niceToHave: 1.4,
  responsibilities: 1.0,
  description: 0.8,
  aboutCompany: 0.3,
};

const DEFAULT_SECTION_WEIGHT = 1;
const TEXT_SEARCH_CONFIG = /^[a-z][a-z0-9_]{0,62}$/i;

export type JobSearchInput = {
  resource: 'job' | 'cv';
  query: string;
  location?: string;
  workModel?: string;
  experienceLevel?: string;
  language?: string;
};

export type JobSearchFilters = {
  location?: string;
  workModel?: string;
  experienceLevel?: string;
};

export function sectionWeight(section: string): number {
  return SECTION_WEIGHTS[section] ?? DEFAULT_SECTION_WEIGHT;
}

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

export function titleMatchesQuery(title: string, query: string): boolean {
  const normalizedTitle = normalizeSearchText(title);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedTitle || !normalizedQuery) return false;

  const paddedTitle = ` ${normalizedTitle} `;
  if (paddedTitle.includes(` ${normalizedQuery} `)) return true;

  const compactQuery = normalizedQuery.replace(/ /g, '');
  const tokens = normalizedTitle.split(' ').filter(Boolean);
  for (let start = 0; start < tokens.length; start++) {
    let joined = '';
    for (let end = start; end < tokens.length; end++) {
      joined += tokens[end];
      if (joined === compactQuery) return true;
      if (joined.length > compactQuery.length) break;
    }
  }

  return false;
}

export function shouldRunHyde(
  query: string,
  titles: readonly string[],
): boolean {
  const trimmed = query.trim();
  if (trimmed.length >= HYDE_QUERY_LENGTH_LIMIT) return false;
  return !titles.some((title) => titleMatchesQuery(title, trimmed));
}

export function searchFilters(input: JobSearchInput): JobSearchFilters {
  return {
    location: blankToUndefined(input.location),
    workModel: blankToUndefined(input.workModel),
    experienceLevel: blankToUndefined(input.experienceLevel),
  };
}

export function hasSearchFilters(filters: JobSearchFilters): boolean {
  return Boolean(
    filters.location || filters.workModel || filters.experienceLevel,
  );
}

export function textSearchConfig(language?: string): string {
  const config = language?.trim();
  if (!config) return 'simple';
  if (!TEXT_SEARCH_CONFIG.test(config)) {
    throw new Error(
      'language must be a Postgres text search configuration name',
    );
  }
  return config.toLowerCase();
}

export function buildSearchPool(
  vectorHits: readonly { id: string; score: number }[],
  keywordHits: readonly { id: string; rank: number }[],
  titleHitIds: readonly string[],
): string[] {
  const ids = new Set<string>([
    ...vectorHits.map((hit) => hit.id),
    ...keywordHits.map((hit) => hit.id),
    ...titleHitIds,
  ]);

  if (ids.size <= MERGE_POOL_LIMIT) return [...ids];

  const pool: string[] = [];
  const kept = new Set<string>();
  for (const id of titleHitIds) {
    if (!ids.has(id) || kept.has(id)) continue;
    kept.add(id);
    pool.push(id);
  }

  const byVectorScore = [...vectorHits].sort(
    (left, right) => right.score - left.score,
  );
  for (const hit of byVectorScore) {
    if (pool.length >= MERGE_POOL_LIMIT) break;
    if (kept.has(hit.id)) continue;
    kept.add(hit.id);
    pool.push(hit.id);
  }

  return pool;
}

export function tierRankedJobs<T extends { id: string; rerankScore: number }>(
  jobs: readonly T[],
  titleHitIds: ReadonlySet<string>,
  limit = RESULT_LIMIT,
): T[] {
  const tier1 = jobs
    .filter((job) => titleHitIds.has(job.id))
    .sort((left, right) => right.rerankScore - left.rerankScore);
  const tier2 = jobs
    .filter(
      (job) => !titleHitIds.has(job.id) && job.rerankScore >= RERANK_FLOOR,
    )
    .sort((left, right) => right.rerankScore - left.rerankScore);

  return [...tier1, ...tier2].slice(0, limit);
}

export function capByRerankFloor<T extends { rerankScore: number }>(
  items: readonly T[],
  limit = RESULT_LIMIT,
): T[] {
  return [...items]
    .filter((item) => item.rerankScore >= RERANK_FLOOR)
    .sort((left, right) => right.rerankScore - left.rerankScore)
    .slice(0, limit);
}

function blankToUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
