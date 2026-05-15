import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, InferSelectModel, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/drizzle/drizzle.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema/index';
import { eq } from 'drizzle-orm';
import { FullSmartProfile, SmartProfileSection } from 'src/common/types/general';
import { PROFILE_SECTIONS } from 'src/common/helpers/consts';

type SmartProfile = InferSelectModel<typeof schema.smartProfiles>;
type Education = InferSelectModel<typeof schema.education>;
type JobExperience = InferSelectModel<typeof schema.jobExperiences>;
type FullProfile = SmartProfile & {
    education: Education[];
    experiences: JobExperience[];
}

@Injectable()
export class SmartProfileService {
    constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) { }

    async getAllSmartProfilesByUser(userId: string): Promise<SmartProfile[] | undefined> {
        if (!userId) {
            console.error("Missing candidate ID in get all profiles");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            return await this.db.query.smartProfiles.findMany({
                where: eq(schema.smartProfiles.candidateId, userId),
                with: {
                    cvs: true,
                    education: true,
                    experiences: true,
                }
            });
        } catch (err: any) {
            console.error('Error fetching smart profile by user:', err);
            throw new BadRequestException(err.message);
        }
    }

    async getMasterSmartProfile(userId: string): Promise<SmartProfile | undefined> {
        if (!userId) {
            console.error("Missing candidate ID in get master profile");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            return await this.db.query.smartProfiles.findFirst({
                where: and(
                    eq(schema.smartProfiles.candidateId, userId),
                    eq(schema.smartProfiles.isMaster, true)
                ),
                with: {
                    cvs: true,
                    education: true,
                    experiences: true,
                }
            });
        } catch (err: any) {
            console.error('Error fetching smart profile by user:', err);
            throw new BadRequestException(err.message);
        }
    }

    async getSmartProfileById(userId: string, profileId: string): Promise<SmartProfile | undefined> {
        if (!profileId || !userId) {
            console.error("Missing IDs in get smart profile by id");
            throw new BadRequestException("Missing IDs");
        }
        try {
            return await this.db.query.smartProfiles.findFirst({
                where: and(
                    eq(schema.smartProfiles.profileId, profileId),
                    eq(schema.smartProfiles.candidateId, userId)
                ),
                with: {
                    cvs: true,
                    education: true,
                    experiences: true,
                }
            });
        } catch (err: any) {
            console.error('Error fetching smart profile by id:', err);
            throw new BadRequestException(err.message);
        }
    }

    async createSmartProfile(body: Partial<SmartProfile>): Promise<SmartProfile> {
        if (!body.candidateId) {
            console.error("Missing candidate ID in create smart profile");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            const newProfile = await this.db.insert(schema.smartProfiles).values(body as any).returning().execute();
            return newProfile[0];
        } catch (err: any) {
            console.error('Error creating smart profile:', err);
            throw new BadRequestException(err.message);
        }
    }

    async upsertEducation(body: Partial<FullSmartProfile>, userId: string) {
        try {
            const educationData = body.education;

            if (!educationData || !Array.isArray(educationData) || educationData.length === 0) {
                console.log("no education data");
                throw new BadRequestException("no education data");
            }

            return await this.db.insert(schema.education)
                .values(educationData)
                .onConflictDoUpdate({
                    target: [schema.education.id, schema.education.profileId],
                    set: {
                        institution: sql`excluded.institution`,
                        degree: sql`excluded.degree`,
                        description: sql`excluded.description`,
                        isOngoing: sql`excluded.is_ongoing`,
                        startDate: sql`excluded.start_date`,
                        endDate: sql`excluded.end_date`,
                    },
                })
                .returning();

        } catch (err: any) {
            console.error('Error upserting education:', err);
            throw new BadRequestException(err.message);
        }
    }

    async upsertJobExperience(body: Partial<FullSmartProfile>, userId: string) {
        try {
            const jobExperienceData = body.experiences;

            if (!jobExperienceData || !Array.isArray(jobExperienceData) || jobExperienceData.length === 0) {
                console.log("no job experience data");
                throw new BadRequestException("no job experience data");
            }

            return await this.db.insert(schema.jobExperiences)
                .values(jobExperienceData)
                .onConflictDoUpdate({
                    target: [schema.jobExperiences.id, schema.jobExperiences.profileId],
                    set: {
                        company: sql`excluded.company`,
                        roleTag: sql`excluded.role_tag`,
                        startDate: sql`excluded.start_date`,
                        endDate: sql`excluded.end_date`,
                        isCurrent: sql`excluded.is_current`,
                        description: sql`excluded.description`,
                    },
                })
                .returning();

        } catch (err: any) {
            console.error('Error upserting job experience:', err);
            throw new BadRequestException(err.message);
        }
    }

    async upsertSmartProfile(body: Partial<FullSmartProfile>, userId: string): Promise<SmartProfile> {
        if (!userId) {
            console.error("user id is missing in upsert smart profile");
            throw new BadRequestException("user id is missing in upsert");
        }

        try {
            const results = await this.db.update(schema.smartProfiles)
                .set(body)
                .where(and(
                    eq(schema.smartProfiles.profileId, body.profileId!),
                    eq(schema.smartProfiles.candidateId, userId)
                )).returning().execute();
            return results[0];
        } catch (err: any) {
            console.error('Error upserting smart profile:', err);
            throw new BadRequestException(err.message);
        }
    }

    async isFirstProfile(userId: string): Promise<boolean> {
        try {
            const [result] = await this.db.select({ value: count() })
                .from(schema.smartProfiles)
                .where(eq(schema.smartProfiles.candidateId, userId));
            return result.value === 0;
        } catch (err: any) {
            console.error('Error counting profiles:', err);
            throw new BadRequestException(err.message);
        }
    }

    async checkProfileBelongToUser(profileId: string, userId: string) {
        const isUserProfile = await this.db.query.smartProfiles.findFirst({
            where: and(
                eq(schema.smartProfiles.profileId, profileId),
                eq(schema.smartProfiles.candidateId, userId)
            ),
        });
        return isUserProfile ? true : false;
    }

    async handleUpsert(body: Partial<FullSmartProfile & { smartProfileId?: string }>, section: SmartProfileSection, userId: string) {
        try {
            // Handle frontend field naming variations
            if (body.smartProfileId && !body.profileId) {
                body.profileId = body.smartProfileId;
            }

            // If no profileId is provided, we create a new profile
            if (!body.profileId) {
                body.candidateId = userId;
                // Automatically set as master if it's the user's first profile
                body.isMaster = await this.isFirstProfile(userId);
                console.log("No profileId provided, creating new profile for user:", userId);
                return await this.createSmartProfile(body);
            }

            // Ensure isMaster is set for the first profile
            if (body.isMaster === undefined) {
                body.isMaster = await this.isFirstProfile(userId);
            }

            const isBelong = await this.checkProfileBelongToUser(body.profileId!, userId);
            if (!isBelong) {
                throw new BadRequestException("Profile does not belong to user");
            }

            // Route to correct handler based on section
            if (section === PROFILE_SECTIONS.EXPERIENCE) {
                return await this.upsertJobExperience(body, userId);
            } else if (section === PROFILE_SECTIONS.EDUCATION) {
                return await this.upsertEducation(body, userId);
            } else {
                return await this.upsertSmartProfile(body, userId);
            }

        } catch (err: any) {
            console.error(`Error in handleUpsert for section ${section}:`, err);
            throw new BadRequestException(err.message);
        }
    }
}
