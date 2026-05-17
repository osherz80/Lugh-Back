import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, InferSelectModel, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/drizzle/drizzle.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema/index';
import { eq } from 'drizzle-orm';
import { FullSmartProfile, OtherSmartProfile, SmartProfileRes, SmartProfileSection } from 'src/common/types/general';
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

    async getOtherSmartProfiles(userId: string): Promise<OtherSmartProfile[]> {
        if (!userId) {
            console.error("Missing candidate ID in get minimal profiles");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            const otherProfiles = await this.db.select({
                profileId: schema.smartProfiles.profileId,
                targetRole: schema.smartProfiles.targetRole
            })
                .from(schema.smartProfiles)
                .where(and(
                    eq(schema.smartProfiles.candidateId, userId),
                    eq(schema.smartProfiles.isMaster, false)
                ));
            return otherProfiles;
        } catch (err: any) {
            console.error('Error fetching minimal profiles:', err);
            throw new BadRequestException(err.message);
        }
    }

    async getMasterSmartProfile(userId: string): Promise<SmartProfileRes | undefined> {
        if (!userId) {
            console.error("Missing candidate ID in get master profile");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            const otherProfiles = await this.getOtherSmartProfiles(userId);
            const masterProfile = await this.db.query.smartProfiles.findFirst({
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
            if (!masterProfile) {
                console.log("No master profile found");
                return undefined;
            }
            return { ...masterProfile, otherProfiles };
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

    async createSmartProfile(body: Partial<SmartProfile>, userId: string): Promise<SmartProfile> {
        if (!userId) {
            console.error("Missing candidate ID in create smart profile");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            const newProfile = await this.db.insert(schema.smartProfiles).values({ ...body, candidateId: userId }).returning().execute();
            return newProfile[0];
        } catch (err: any) {
            console.error('Error creating smart profile:', err);
            throw new BadRequestException(err.message);
        }
    }

    async upsertEducation(stepData: Education[], profileId: string) {
        try {
            if (!stepData || !Array.isArray(stepData) || stepData.length === 0) {
                console.log("no education data");
                throw new BadRequestException("no education data");
            }

            const dataToInsert = stepData.map(job => ({
                ...job,
                profileId: profileId
            }));

            return await this.db.insert(schema.education)
                .values(dataToInsert)
                .onConflictDoUpdate({
                    target: [schema.education.id, schema.education.profileId],
                    set: {
                        profileId: profileId,
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

    async upsertJobExperience(stepData: JobExperience[], profileId: string) {
        try {
            if (!stepData || !Array.isArray(stepData) || stepData.length === 0) {
                console.log("no job experience data");
                throw new BadRequestException("no job experience data");
            }

            const dataToInsert = stepData.map(job => ({
                ...job,
                profileId: profileId
            }));

            return await this.db.insert(schema.jobExperiences)
                .values(dataToInsert)
                .onConflictDoUpdate({
                    target: [schema.jobExperiences.id, schema.jobExperiences.profileId],
                    set: {
                        profileId: profileId,
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

    async upsertSmartProfile(body: Partial<Omit<FullSmartProfile, 'profileId'>>, userId: string, profileId: string): Promise<SmartProfile> {
        if (!userId) {
            console.error("user id is missing in upsert smart profile");
            throw new BadRequestException("user id is missing in upsert");
        }

        try {
            const results = await this.db.update(schema.smartProfiles)
                .set(body)
                .where(and(
                    eq(schema.smartProfiles.profileId, profileId),
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

    async handleUpsert(stepData: Partial<Omit<FullSmartProfile, 'profileId'>>, section: SmartProfileSection, userId: string, profileId?: string) {
        let data: any;

        try {
            // If no profileId is provided, we create a new profile
            if (!profileId) {
                // Automatically set as master if it's the user's first profile
                stepData.isMaster = await this.isFirstProfile(userId);
                console.log("No profileId provided, creating new profile for user:", userId);
                return await this.createSmartProfile(stepData, userId);
            }

            const isBelong = await this.checkProfileBelongToUser(profileId, userId);
            if (!isBelong) {
                throw new BadRequestException("Profile does not belong to user");
            }

            if (section === PROFILE_SECTIONS.EXPERIENCE) {
                data = await this.upsertJobExperience(stepData as JobExperience[], profileId);
            } else if (section === PROFILE_SECTIONS.EDUCATION) {
                data = await this.upsertEducation(stepData as Education[], profileId);
            } else if (section === PROFILE_SECTIONS.SKILLS) {
                data = await this.upsertSmartProfile({ skills: stepData as any }, userId, profileId);
            } else if (section === PROFILE_SECTIONS.PERSONA) {
                data = await this.upsertSmartProfile({ persona: stepData as any }, userId, profileId);
            } else {
                data = await this.upsertSmartProfile(stepData, userId, profileId);
            }

            await this.incrementProfileStep(profileId);
            return data;
        } catch (err: any) {
            console.error(`Error in handleUpsert for section ${section}:`, err);
            throw new BadRequestException(err.message);
        }
    }

    async incrementProfileStep(profileId: string) {
        try {
            const results = await this.db.update(schema.smartProfiles)
                .set({
                    currentStep: sql`${schema.smartProfiles.currentStep} + 1`
                })
                .where(eq(schema.smartProfiles.profileId, profileId))
                .returning()
                .execute();
            return results[0];
        } catch (err: any) {
            console.error('Error incrementing profile step:', err);
            throw new BadRequestException(err.message);
        }
    }
}
