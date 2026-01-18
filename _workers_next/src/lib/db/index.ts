import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
// import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// D1 Proxy to bridge async context with sync Drizzle setup
class D1StatementProxy {
    constructor(private query: string, private bindings: any[] = []) { }

    bind(...values: any[]) {
        return new D1StatementProxy(this.query, [...this.bindings, ...values]);
    }

    async all() {
        const db = await getD1();
        return db.prepare(this.query).bind(...this.bindings).all();
    }

    async first(colName?: string) {
        const db = await getD1();
        return db.prepare(this.query).bind(...this.bindings).first(colName);
    }

    async run() {
        const db = await getD1();
        return db.prepare(this.query).bind(...this.bindings).run();
    }

    async raw(options?: any) {
        const db = await getD1();
        return db.prepare(this.query).bind(...this.bindings).raw(options);
    }
}

class D1Proxy {
    prepare(query: string) {
        return new D1StatementProxy(query);
    }

    async dump() {
        const db = await getD1();
        return db.dump();
    }

    async batch(statements: any[]) {
        const db = await getD1();
        // Re-construct real statements from proxies
        const realStatements = statements.map((s: any) =>
            db.prepare(s.query).bind(...s.bindings)
        );
        return db.batch(realStatements);
    }

    async exec(query: string) {
        const db = await getD1();
        return db.exec(query);
    }
}

async function getD1() {
    try {
        const ctx = await getCloudflareContext();
        if ((ctx as any)?.env?.DB) {
            return (ctx as any).env.DB;
        }
    } catch (e) {
        // Ignore
    }
    throw new Error("D1 Database binding not found in Cloudflare context");
}

const getDb = () => {
    // 1. Production / Cloudflare context: Use Proxy
    if (process.env.NODE_ENV === 'production' || process.env.NEXT_RUNTIME === 'edge') {
        const d1Proxy = new D1Proxy() as any; // Cast to satisfy type check
        return drizzleD1(d1Proxy, { schema });
    }

    // 2. Local fallback (Sync)
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        // const Database = require('better-sqlite3');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        // const { drizzle: drizzleSqlite } = require('drizzle-orm/better-sqlite3');
        // const sqlite = new Database(process.env.LOCAL_DB_PATH || 'local.sqlite');
        // return drizzleSqlite(sqlite, { schema });
        throw new Error("Local SQLite not supported in this build")
    } catch (e) {
        // Fallback to D1 proxy if better-sqlite3 fails (e.g. inside `next build` which might run in node mode but target edge)
        console.warn('Local SQLite failed, falling back to D1 Proxy', e);
        const d1Proxy = new D1Proxy() as any;
        return drizzleD1(d1Proxy, { schema });
    }
};

export const db = getDb();
