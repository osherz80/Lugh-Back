import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { ConfigService } from '@nestjs/config';

export const DRIZZLE = 'DRIZZLE';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (configService: ConfigService) => {
        const user = configService.get<string>('DB_USER');
        const password = encodeURIComponent(configService.get<string>('DB_PASSWORD') || '');
        const host = configService.get<string>('DB_POOLER_HOST');
        const port = configService.get<string>('DB_POOLER_PORT');
        const dbName = configService.get<string>('DB_NAME');
        const databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not defined');
        }
        const queryClient = postgres(databaseUrl);
        return drizzle(queryClient, { schema });
      },
      inject: [ConfigService],
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule { }
