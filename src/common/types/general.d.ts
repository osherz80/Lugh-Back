import { InferSelectModel } from "drizzle-orm";
import { users, candidates, cvs } from "../../db/schema";

type User = InferSelectModel<typeof users>;
type Candidate = InferSelectModel<typeof candidates>;
type CV = InferSelectModel<typeof cvs>;

export type FullUser = User & {
    candidate?: (Candidate & {
        cvs?: CV[];
    }) | null;
};