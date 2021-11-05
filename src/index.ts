import { SessionData, SessionStore } from '@mgcrea/fastify-session';
import { EventEmitter } from 'events';
import Database, {Database as DatabaseType} from "better-sqlite3"

export type SQLiteStoreOptions = {
	filename?: string
	tableName?: string
	ttl?: number
};

export const DEFAULT_TTL = 86400; // one day in seconds
export const DEFAULT_TABLENAME = "sessions"
export const DEFAULT_DBNAME = "sessions.sqlite"

export class SQLiteStore<T extends SessionData = SessionData> extends EventEmitter implements SessionStore {
	private client: DatabaseType
	readonly ttl: number
	readonly tableName: string

	constructor({
		filename=DEFAULT_DBNAME,
		ttl=DEFAULT_TTL,
		tableName=DEFAULT_TABLENAME
	}: SQLiteStoreOptions) {
		super()
		this.client = new Database(filename)
		this.ttl = ttl
		this.tableName = tableName
		
		this.client.exec(`CREATE TABLE IF NOT EXISTS ${this.tableName} (
			sid TEXT UNIQUE,
			expiry NUMBER DEFAULT '${this.ttl}',
			data TEXT
		)`)
	}

	private getTTL(expiry?: number|null) {
		return expiry ? Math.min(Math.floor((expiry - Date.now()) / 1000), this.ttl) : this.ttl;
	}

	async get(sessionID: string): Promise<[SessionData, number]> {
		const returned = this.client.prepare(`SELECT * FROM \`${this.tableName}\` WHERE sid = '${sessionID}'`).all()[0]
		if (!returned) return null
		// if the session is expired
		if (returned.expiry < Date.now()) {
			await this.destroy(sessionID)
			return null
		}
		return [JSON.parse(returned.data), Number(returned.expiry)]
	}

	/**
	 * 
	 * @param expiry TTL, relative to epoch (Date.now() + X for X TTL)
	 */
	async set(sessionID: string, data: SessionData, expiry?: number|null) {
		const ttl = this.getTTL(expiry)
		
		// insert into db. if the session already exists, set it to the new data and prolong expiry
		this.client.prepare(`
			INSERT INTO \`${this.tableName}\` (sid, expiry, data)
				values ('${sessionID}', ${ttl+Date.now()}, '${JSON.stringify(data)}')
			ON CONFLICT (sid) DO
			UPDATE SET data='${JSON.stringify(data)}',expiry=${ttl+Date.now()}
			;`).run()
		return
	}
	
	/**
	 * 
	 * @param expiry TTL, relative to epoch (Date.now() + X for X TTL)
	 */
	async touch(sessionID: String, expiry?: number | null) {
		const ttl = this.getTTL(expiry)
		this.client.exec(`INSERT INTO ${this.tableName} (sid, expiry) values ('${sessionID}', ${ttl+Date.now()})`)
		return
	}

	async destroy(sessionID: string) {
		this.client.exec(`DELETE FROM ${this.tableName} where sid = '${sessionID}'`)
		return
	}
}