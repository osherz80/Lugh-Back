import { InferSelectModel } from "drizzle-orm";
import { users, candidates, cvs, smartProfiles } from "../../db/schema";
import { ANALYSIS_METRICS } from "../helpers/consts";

type User = InferSelectModel<typeof users>;
type SmartProfile = InferSelectModel<typeof smartProfiles>;
type CV = InferSelectModel<typeof cvs>;

export type FullUser = User & {
    smartProfiles?: SmartProfile[];
};

export type AnalysisMetrics = typeof ANALYSIS_METRICS[keyof typeof ANALYSIS_METRICS];