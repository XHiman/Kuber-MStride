import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const localDatabaseUrl = `file:${resolve(__dirname, '../../prisma/dev.db').replace(/\\/g, '/')}`;
    super({
      datasources: {
        db: { url: process.env.DATABASE_URL || localDatabaseUrl },
      },
    });
  }

  async onModuleInit() {
    if (
      process.env.NODE_ENV === 'production'
      || process.env.RENDER === 'true'
      || Boolean(process.env.RENDER_SERVICE_ID)
    ) {
      assertProductionDatabaseIsPersistent(
        process.env.DATABASE_URL,
        process.env.DATABASE_PERSISTENT_DIR || '/var/data',
      );
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export function assertProductionDatabaseIsPersistent(
  databaseUrl: string | undefined,
  persistentDirectory: string,
): void {
  if (!databaseUrl?.startsWith('file:')) {
    throw new Error('Production requires DATABASE_URL to point to the persistent SQLite disk.');
  }

  let databasePath: string;
  try {
    databasePath = fileURLToPath(new URL(databaseUrl));
  } catch {
    throw new Error('Production DATABASE_URL must be an absolute SQLite file URL on the persistent disk.');
  }

  const persistentRoot = resolve(persistentDirectory);
  const resolvedDatabasePath = resolve(databasePath);
  const relativeDatabasePath = relative(persistentRoot, resolvedDatabasePath);
  if (
    !isAbsolute(databasePath)
    || relativeDatabasePath === ''
    || relativeDatabasePath === '..'
    || relativeDatabasePath.startsWith(`..${sep}`)
    || isAbsolute(relativeDatabasePath)
  ) {
    throw new Error(`Production database must be stored under the persistent disk mount ${persistentRoot}.`);
  }

  let databaseStat;
  try {
    databaseStat = statSync(resolvedDatabasePath);
  } catch {
    throw new Error(`Production database file ${resolvedDatabasePath} does not exist; refusing to create an empty database.`);
  }
  if (!databaseStat.isFile()) {
    throw new Error(`Production database path ${resolvedDatabasePath} is not a file.`);
  }
}
