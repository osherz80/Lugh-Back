import { Injectable, Logger } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';
import { CV, Job } from 'src/common/types/general';

export interface RerankedJobResult extends Job {
    vectorScore: number;
    rerankScore: number;
}

export type Reranked<T> = T & {
    vectorScore: number;
    rerankScore: number;
};

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
        candidates: (Job & { score: number })[],
    ): Promise<RerankedJobResult[]> {
        return this.rerankItems(userQuery, candidates, (job) => this.formatJobForReranker(job));
    }

    async rerankCvs(
        userQuery: string,
        candidates: (CV & { score: number })[],
    ): Promise<Reranked<CV & { score: number }>[]> {
        return this.rerankItems(userQuery, candidates, (cv) => this.formatCvForReranker(cv));
    }

    private async rerankItems<T extends { score: number }>(
        userQuery: string,
        candidates: T[],
        format: (item: T) => string,
    ): Promise<Reranked<T>[]> {
        if (!candidates || candidates.length === 0) {
            return [];
        }

        try {
            const documents = candidates.map((item) => format(item));
            const response = await this.cohere.rerank({
                model: 'rerank-v3.5',
                query: userQuery,
                documents,
                topN: documents.length,
            });

            return response.results.map((result) => {
                const originalCandidate = candidates[result.index];
                return {
                    ...originalCandidate,
                    vectorScore: originalCandidate.score,
                    rerankScore: Number(result.relevanceScore.toFixed(4)),
                };
            });
        } catch (error) {
            this.logger.error('Cross-Encoder reranking failed:', error);
            return candidates.map((item) => ({
                ...item,
                vectorScore: item.score,
                rerankScore: item.score,
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

    private formatCvForReranker(cv: CV): string {
        const parts: string[] = [];

        if (cv.targetRole) parts.push(`Target role: ${cv.targetRole}`);
        if (cv.summary) parts.push(`Summary: ${cv.summary}`);
        if (cv.skills?.length) {
            parts.push(`Skills: ${cv.skills.map((group) => `${group.category}: ${group.skills.join(', ')}`).join('; ')}`);
        }
        if (cv.experiences?.length) {
            parts.push(`Experience: ${cv.experiences.map((experience) => `${experience.roleTag}: ${experience.description}`).join('\n')}`);
        }

        return parts.join('\n') || 'CV';
    }
}
