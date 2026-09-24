import { Injectable, Logger } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import { jobs } from '../db/schema'
import { Job } from 'src/common/types/general';

export interface RerankedJobResult extends Job {
    vectorScore: number;
    rerankScore: number;
}

@Injectable()
export class RerankerService {
    private readonly logger = new Logger(RerankerService.name);
    private readonly cohere: CohereClient;

    constructor() {
        this.cohere = new CohereClient({
            token: process.env.COHERE_API_KEY || '',
        });
    }

    /**
     * Reranks a candidate list of jobs against the user's search query.
     * Cross-encoders process (Query + Document) jointly, capturing subtle domain dependencies.
     */
    async rerankJobs(
        userQuery: string,
        candidates: (Job & { retrievalScore: number })[],
        topK = 10,
        minScoreCutoff = 0.35, // Hard cutoff threshold to filter irrelevant noise
    ): Promise<RerankedJobResult[]> {
        if (!candidates || candidates.length === 0) {
            return [];
        }

        try {
            // 1. Format candidate records into structured text payloads for the Cross-Encoder
            const documents = candidates.map((job) => this.formatJobForReranker(job));

            // 2. Call Cohere Rerank API (using rerank-v3.5 for optimal domain precision)
            const response = await this.cohere.rerank({
                model: 'rerank-v3.5',
                query: userQuery,
                documents: documents,
                topN: topK,
            });

            // 3. Map results back to full job entities with calibrated confidence scores
            const rerankedResults: RerankedJobResult[] = response.results
                .filter((result) => result.relevanceScore >= minScoreCutoff)
                .map((result) => {
                    const originalCandidate = candidates[result.index];
                    return {
                        ...originalCandidate,
                        vectorScore: originalCandidate.retrievalScore,
                        rerankScore: Number(result.relevanceScore.toFixed(4)), // Normalized 0.0 - 1.0 confidence
                    };
                });

            return rerankedResults;
        } catch (error) {
            this.logger.error('Cross-Encoder reranking failed:', error);
            // Fallback: If reranker API fails, return top-K vector candidate matches directly
            return candidates.slice(0, topK).map((job) => ({
                ...job,
                vectorScore: job.retrievalScore,
                rerankScore: job.retrievalScore,
            }));
        }
    }

    /**
     * Constructs a compact, high-density text representation of a job post.
     * Excludes low-signal fluff (benefits/about) to optimize token budget and relevance.
     */
    private formatJobForReranker(job: Job): string {
        const parts: string[] = [];

        if (job.title) parts.push(`Title: ${job.title}`);
        if (job.requirements) parts.push(`Requirements: ${job.requirements}`);
        if (job.responsibilities) parts.push(`Responsibilities: ${job.responsibilities}`);
        if (job.niceToHave) parts.push(`Nice to Have: ${job.niceToHave}`);
        if (job.location) parts.push(`Location: ${job.location}`);

        return parts.join('\n');
    }
}