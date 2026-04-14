import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const buildDirectUrl = () => {
    const user = process.env.DB_USER;
    const password = encodeURIComponent(process.env.DB_PASSWORD || '');
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const dbName = process.env.DB_NAME;

    return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
};

const connectionString = buildDirectUrl();

// Explicitly disable prefetch as it is not supported for some environments
// but usually it's fine for local pg.
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
