import { InferSelectModel } from "drizzle-orm";
import { users, candidates, cvs } from "../../db/schema";
import { ANALYSIS_METRICS } from "../helpers/consts";

type User = InferSelectModel<typeof users>;
type Candidate = InferSelectModel<typeof candidates>;
type CV = InferSelectModel<typeof cvs>;

export type FullUser = User & {
    candidate?: (Candidate & {
        cvs?: CV[];
    }) | null;
};

export type AnalysisMetrics = typeof ANALYSIS_METRICS[keyof typeof ANALYSIS_METRICS];