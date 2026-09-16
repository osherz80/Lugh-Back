import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "../../db/schema";
import { ANALYSIS_METRICS, PROFILE_SECTIONS } from "../helpers/consts";
import { cvContentColumns, cvMetadataColumns, cvMetricsColumns } from "src/db/schema/cvs";

export type User = InferSelectModel<typeof schema.users>;
export type Job = InferSelectModel<typeof schema.jobs>;
export type Chunk = InferSelectModel<typeof schema.documentChunks>;
export type CV = InferSelectModel<typeof schema.cvs>;
export type InsertModel = InferInsertModel<typeof schema.cvs>;
type SelectModel = InferSelectModel<typeof schema.cvs>;

export type StrictNewCV = {
    [K in keyof InsertModel as undefined extends InsertModel[K] ? never : K]: InsertModel[K];
};
export type CVExperiences = CV['experiences']
export type CVEducations = CV['education']
export type CVSkills = CV['skills']
export type CVExtraEntries = CV['cvExtraEntries']

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

export type InferColumnsData<T extends Record<string, any>> = {
    [K in keyof T]: T[K]['_']['data'];
};

type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type CVMetadata = Prettify<InferColumnsData<typeof cvMetadataColumns>>;
export type CVMetrics = Prettify<InferColumnsData<typeof cvMetricsColumns>>;
export type CVContent = Prettify<InferColumnsData<typeof cvContentColumns>>;