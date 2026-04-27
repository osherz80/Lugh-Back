import { Request, Response } from 'express';
import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from 'src/drizzle/drizzle.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users, cvs } from 'src/db/schema/index';
import { eq, InferSelectModel } from 'drizzle-orm';

type User = InferSelectModel<typeof users>;

@Injectable()
export class CvsService {
    constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase) { }

    async getCandidateCVs(req: Request, res: Response, userId: string) {
        try {
            const candidateCvs = await this.db
                .select()
                .from(cvs)
                .where(eq(cvs.candidateId, userId));

            return res.status(200).json(candidateCvs);
        } catch (error) {
            console.error('Error fetching candidate CVs:', error);
            throw new BadRequestException('Failed to fetch CVs');
        }
    }

}