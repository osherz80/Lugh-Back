-- Job search retrieval support.
-- Weights match sectionWeight() in src/jobs/job-search.ts.
-- Run once against the application database. This does not re-embed any chunks.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS jobs_title_requirements_search_idx
ON jobs
USING gin (to_tsvector('simple', title || ' ' || coalesce(requirements, '')));

UPDATE document_chunks
SET weight = CASE section
  WHEN 'title' THEN 2.2
  WHEN 'requirements' THEN 1.8
  WHEN 'niceToHave' THEN 1.4
  WHEN 'responsibilities' THEN 1.0
  WHEN 'description' THEN 0.8
  WHEN 'aboutCompany' THEN 0.3
  ELSE 1.0
END;
