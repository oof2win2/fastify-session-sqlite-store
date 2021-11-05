import {SQLiteStore} from "../src/index"


const wait = (ms: number) => {
	return new Promise((resolve) => {
		setTimeout(() => resolve(null), ms)
	})
}


describe("SQLiteStore", () => {
	it("Should be able to create itself", () => {
		const store = new SQLiteStore({filename: ":memory:"})
		expect(store).toBeInstanceOf(SQLiteStore)
	})
	it("Should be able to set, get and delete keys", async () => {
		const store = new SQLiteStore({filename: ":memory:"})
		await store.set("someKey", {hello: "world"})

		const set = await store.get("someKey")
		expect(set[0].hello).toBe("world")

		// check if destroying actually destroys it
		await store.destroy("someKey")
		const del = await store.get("someKey")
		expect(del).toBeNull()
	})
	it("Should be able to touch keys without any data", async () => {
		const store = new SQLiteStore({filename: ":memory:"})
		await store.touch("someKey")

		const set = await store.get("someKey")
		expect(set[0]).toBeNull()
	})
	it("Should be able to create keys with shorter expiry dates", async () => {
		const store = new SQLiteStore({filename: ":memory:"})
		const now = Date.now()
		await store.set("someKey", {hello: "world"}, Date.now() + 1200)
		const res = await store.get("someKey")
		
		// expect the timeout to be lower than the creation date + default TTL
		expect(res[1]).toBeLessThan(now + store.ttl)
	})
	it("Should expire keys after their expiration dates", async () => {
		const store = new SQLiteStore({filename: ":memory:"})
		await store.set("someKey", {hello: "world"}, Date.now() + 200)
		await wait(200)
		const res = await store.get("someKey")
		expect(res).toBeNull()
	})
})