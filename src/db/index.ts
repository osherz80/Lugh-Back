import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;

// Explicitly disable prefetch as it is not supported for some environments
// but usually it's fine for local pg.
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
