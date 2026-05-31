import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count, InferSelectModel, sql } from 'drizzle-orm';
import { DRIZZLE } from 'src/drizzle/drizzle.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema/index';
import { eq } from 'drizzle-orm';
import { FullSmartProfile, OtherSmartProfile, SmartProfileRes, SmartProfileSection } from 'src/common/types/general';
import { PROFILE_SECTIONS } from 'src/common/helpers/consts';
import { askAiV2 } from 'src/common/helpers/ai';
import * as spPrompts from 'src/common/prompts/smartProfile'

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

    async getFlatOtherSmartProfiles(userId: string): Promise<OtherSmartProfile[]> {
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

    async getFullOtherSmartProfiles(userId: string): Promise<FullSmartProfile[]> {
        if (!userId) {
            console.error("Missing candidate ID in get other profiles");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            return await this.db.query.smartProfiles.findMany({
                where: and(
                    eq(schema.smartProfiles.candidateId, userId),
                    eq(schema.smartProfiles.isMaster, false)
                ),
                with: {
                    education: true,
                    experiences: true,
                }
            });
        } catch (err: any) {
            console.error('Error fetching other smart profiles:', err);
            throw new BadRequestException(err.message);
        }
    }

    async getMasterSmartProfile(userId: string): Promise<SmartProfileRes | undefined> {
        if (!userId) {
            console.error("Missing candidate ID in get master profile");
            throw new BadRequestException("Missing candidate ID");
        }
        try {
            const otherProfiles = await this.getFlatOtherSmartProfiles(userId);
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

    async getProfileExperiences(profileId: string): Promise<JobExperience[]> {
        if (!profileId) {
            console.error("Missing profile id in get profile jobs");
            throw new BadRequestException("Missing profile id");
        }
        try {
            return await this.db.query.jobExperiences.findMany({
                where: eq(schema.jobExperiences.profileId, profileId),
            });
        } catch (err: any) {
            console.error('Error fetching profile jobs:', err);
            throw new BadRequestException(err.message);
        }
    }

    async getProfileEducation(profileId: string): Promise<Education[]> {
        if (!profileId) {
            console.error("Missing profile id in get profile education");
            throw new BadRequestException("Missing profile id");
        }
        try {
            return await this.db.query.education.findMany({
                where: eq(schema.education.profileId, profileId),
            });
        } catch (err: any) {
            console.error('Error fetching profile education:', err);
            throw new BadRequestException(err.message);
        }
    }

    async getFlatProfile(profileId: string): Promise<SmartProfile | undefined> {
        if (!profileId) {
            console.error("Missing profile id in get flat profile");
            throw new BadRequestException("Missing profile id");
        }
        try {
            return await this.db.query.smartProfiles.findFirst({
                where: eq(schema.smartProfiles.profileId, profileId),
            }).execute();
        } catch (err: any) {
            console.error('Error fetching smart profile by id:', err);
            throw new BadRequestException(err.message);
        }
    }

    async getFullProfile(profileId: string, userId: string): Promise<FullSmartProfile> {
        try {
            const isUserProfile = await this.checkProfileBelongToUser(profileId, userId);
            if (!isUserProfile) {
                console.error("Profile does not belong to user in get full profile");
                throw new BadRequestException("Profile does not belong to user");
            }

            const [profile, education, experiences] = await Promise.all([
                this.getFlatProfile(profileId),
                this.getProfileEducation(profileId),
                this.getProfileExperiences(profileId)
            ]);
            if (!profile) {
                console.error("Profile not found in get full profile");
                throw new BadRequestException("Profile not found");
            }
            return { ...profile, education, experiences };
        } catch (err: any) {
            console.error('Error fetching full profile:', err);
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

            const educationPromise = this.db.insert(schema.education)
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

            const [education, fullProfile] = await Promise.all([educationPromise, this.getFlatProfile(profileId)])
            const updatedProfile = {
                ...fullProfile,
                education
            }
            return updatedProfile

        } catch (err: any) {
            console.error('Error upserting education:', err);
            throw new BadRequestException(err.message);
        }
    }

    async deleteEducation(educationId: string, userId: string) {
        try {
            const education = await this.db.select()
                .from(schema.education)
                .where(eq(schema.education.id, educationId))
                .execute();

            if (!education || education.length === 0) {
                throw new BadRequestException("Education not found");
            }

            const profileId = education[0].profileId;
            const isBelong = await this.checkProfileBelongToUser(profileId, userId);
            if (!isBelong) {
                throw new BadRequestException("Profile does not belong to user");
            }
            const results = await this.db.delete(schema.education)
                .where(eq(schema.education.id, educationId))
                .execute();
            return results;
        } catch (err: any) {
            console.error('Error deleting education:', err);
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



            const jobsPromise = this.db.insert(schema.jobExperiences)
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

            const [jobs, fullProfile] = await Promise.all([jobsPromise, this.getFlatProfile(profileId)])
            const updatedProfile = {
                ...fullProfile,
                jobs
            }
            return updatedProfile

        } catch (err: any) {
            console.error('Error upserting job experience:', err);
            throw new BadRequestException(err.message);
        }
    }

    async deleteJobExperience(experienceId: string, userId: string) {
        try {
            const jobExperience = await this.db.select()
                .from(schema.jobExperiences)
                .where(eq(schema.jobExperiences.id, experienceId))
                .execute();

            if (!jobExperience || jobExperience.length === 0) {
                throw new BadRequestException("Job experience not found");
            }

            const profileId = jobExperience[0].profileId;
            const isBelong = await this.checkProfileBelongToUser(profileId, userId);
            if (!isBelong) {
                throw new BadRequestException("Profile does not belong to user");
            }
            const results = await this.db.delete(schema.jobExperiences)
                .where(eq(schema.jobExperiences.id, experienceId))
                .execute();
            return results;
        } catch (err: any) {
            console.error('Error deleting job experience:', err);
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
            await this.setMaster(userId, profileId);
            const fullProfile = await this.getFullProfile(profileId, userId);
            return fullProfile;
        } catch (err: any) {
            console.error(`Error in handleUpsert for section ${section}:`, err);
            throw new BadRequestException(err.message);
        }
    }

    async incrementProfileStep(profileId: string) {
        return
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

    async setMaster(userId: string, profileId: string) {
        try {
            const isBelong = await this.checkProfileBelongToUser(profileId, userId);
            if (!isBelong) {
                throw new BadRequestException("Profile does not belong to user");
            }

            const results = await this.db.update(schema.smartProfiles)
                .set({
                    isMaster: false
                })
                .where(eq(schema.smartProfiles.isMaster, true))
                .execute();

            const results2 = await this.db.update(schema.smartProfiles)
                .set({
                    isMaster: true
                })
                .where(eq(schema.smartProfiles.profileId, profileId))
                .execute();
            return results2;
        } catch (err: any) {
            console.error('Error setting master:', err);
            throw new BadRequestException(err.message);
        }
    }

    async createCvSummarySection(smartProfile: FullSmartProfile) {
        try {

            const dataForSummary = {
                targetRole: smartProfile.targetRole,
                yearsOfExperience: smartProfile.yearsOfExperience,
                persona: {
                    story: smartProfile.persona?.story,
                    style: smartProfile.persona?.style,
                    strengths: smartProfile.persona?.strengths,
                }
            };

            const promptReadyData = `Here is the candidate data to process: ${JSON.stringify(dataForSummary)}`;

            const summary = await askAiV2(spPrompts.SP_CV_SUMMARY_GENERATOR_V2, promptReadyData)
            return summary;
        }
        catch (err: any) {
            console.error('Error creating cv summary section:', err);
            throw new BadRequestException(err.message);
        }
    }

    async createExpBullets(fullProfile: FullSmartProfile) {
        const bulletsSchema = {
            type: 'OBJECT',
            properties: {
                bullets: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                }
            },
            required: ['bullets']
        };

        const currentJobInstruction = "This is the candidate's CURRENT role. Write all bullets strictly in the PRESENT tense (e.g., Manage, Implement, Coordinate)."
        const prevJobInstruction = "This is a PAST role. Write all bullets strictly in the PAST tense (e.g., Managed, Implemented, Coordinated)."

        try {

            const processedExperiences = await Promise.all(
                fullProfile.experiences.map(async (exp) => {

                    const promptReadyData = {
                        roleTag: exp.roleTag || fullProfile.targetRole,
                        description: exp.description,
                        timeContext: exp.isCurrent ? currentJobInstruction : prevJobInstruction
                    };


                    const aiResult = await askAiV2<{ bullets: string[] }>(
                        spPrompts.SP_CV_EXP_BULLETS_GENERATOR,
                        promptReadyData,
                        0.3,
                        bulletsSchema
                    );

                    return {
                        id: exp.id,
                        company: exp.company,
                        roleTag: exp.roleTag,
                        startDate: exp.startDate,
                        endDate: exp.endDate,
                        isCurrent: exp.isCurrent,
                        bullets: aiResult?.bullets || []
                    };
                })
            );
            console.log('expBullets is', processedExperiences);
            return processedExperiences;
        } catch (err: any) {
            console.error('Error creating exp bullets:', err);
            throw new BadRequestException(err.message);
        }
    }

    async smartProfileToCv(userId: string, smartProfileId: string) {
        try {
            const fullProfile = await this.getFullProfile(smartProfileId, userId);
            if (!fullProfile) {
                throw new BadRequestException("Profile not found");
            }
            // const summary = await this.createCvSummarySection(fullProfile);
            // console.log("summary is", summary);
            const expBullets = await this.createExpBullets(fullProfile);
            console.log("expBullets is", expBullets);
            return expBullets;
        } catch (err: any) {
            console.error('Error creating cv summary section:', err);
            throw new BadRequestException(err.message);
        }
    }
}
