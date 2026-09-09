import { InferSelectModel } from "drizzle-orm";
import * as schema from "../../db/schema";
import { ANALYSIS_METRICS, PROFILE_SECTIONS } from "../helpers/consts";

export type User = InferSelectModel<typeof schema.users>;
export type CV = InferSelectModel<typeof schema.cvs>;
export type Job = InferSelectModel<typeof schema.jobs>;
export type Chunk = InferSelectModel<typeof schema.documentChunks>;

export type FullUser = User & {
    smartProfiles?: SmartProfile[];
};

export type AnalysisMetrics = typeof ANALYSIS_METRICS[keyof typeof ANALYSIS_METRICS];

export type SmartProfile = InferSelectModel<typeof schema.smartProfiles>;
export type OtherSmartProfile = {
    profileId: string;
    targetRole: string | null;
};
export type Education = InferSelectModel<typeof schema.education>;
export type JobExperience = InferSelectModel<typeof schema.jobExperiences>;
export type FullSmartProfile = SmartProfile & {
    education: Education[];
    experiences: JobExperience[];
}
export type SmartProfileRes = FullSmartProfile & { otherProfiles: OtherSmartProfile[] }
export type SmartProfileSection = (typeof PROFILE_SECTIONS)[keyof typeof PROFILE_SECTIONS];

export type SkillByCategory = { category: string, skills: string[] }