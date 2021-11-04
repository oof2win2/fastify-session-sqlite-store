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

		const prep = `CREATE TABLE IF NOT EXISTS ${this.tableName} (
			sid TEXT PRIMARY_KEY,
			expiry NUMBER DEFAULT '${this.ttl}',
			data TEXT
		)`
		
		this.client.exec(prep)
	}

	private getTTL(expiry?: number|null) {
		return expiry ? Math.min(Math.floor((expiry - Date.now()) / 1000), this.ttl) : this.ttl;
	}

	async get(sessionID: string): Promise<[SessionData, number]> {
		const returned = this.client.prepare(`SELECT * FROM \`${this.tableName}\` WHERE sid = ${sessionID}`).all()[0]
		if (!returned) return null
		if (returned.expiry < Date.now()) return null
		return [JSON.parse(returned.data), Number(returned.expiry)]
	}

	async set(sessionID: string, data: SessionData, expiry?: number|null) {
		const ttl = this.getTTL(expiry)
		this.client.prepare(`INSERT INTO ${this.tableName} (sid, expiry, data) values (${sessionID}, ${ttl+Date.now()}, '${JSON.stringify(data)}')`).run()
		return
	}

	async destroy(sessionID: string) {
		const data = this.client.exec(`DELETE FROM ${this.tableName} where sid = ${sessionID}`)
		return
	}

	async touch(sessionID: String, expiry?: number | null) {
		const ttl = this.getTTL(expiry)
		const data = this.client.exec(`INSERT INTO ${this.tableName} (sid, expiry) values (${sessionID}, ${ttl+Date.now()})`)
		return
	}
}