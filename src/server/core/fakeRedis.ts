// Test-only in-memory stand-in for the Devvit Redis client. It implements exactly the hash,
// sorted-set and key calls the server code uses, with Redis semantics for each.
type ZOpts = { by: 'rank' | 'score' | 'lex'; reverse?: boolean };

export class FakeRedis {
  hashes = new Map<string, Map<string, string>>();
  zsets = new Map<string, Map<string, number>>();
  insertOrder = new Map<string, Map<string, number>>();
  private seq = 0;

  private h(key: string) {
    let m = this.hashes.get(key);
    if (!m) this.hashes.set(key, (m = new Map()));
    return m;
  }
  private z(key: string) {
    let m = this.zsets.get(key);
    if (!m) this.zsets.set(key, (m = new Map()));
    let o = this.insertOrder.get(key);
    if (!o) this.insertOrder.set(key, (o = new Map()));
    return { m, o };
  }

  async hGet(key: string, field: string) {
    return this.hashes.get(key)?.get(field);
  }
  async hGetAll(key: string) {
    return Object.fromEntries(this.hashes.get(key) ?? []);
  }
  async hSet(key: string, values: Record<string, string>) {
    const m = this.h(key);
    let added = 0;
    for (const [f, v] of Object.entries(values)) {
      if (!m.has(f)) added++;
      m.set(f, v);
    }
    return added;
  }
  async hSetNX(key: string, field: string, value: string) {
    const m = this.h(key);
    if (m.has(field)) return 0;
    m.set(field, value);
    return 1;
  }
  async hDel(key: string, fields: string[]) {
    const m = this.hashes.get(key);
    let n = 0;
    for (const f of fields) if (m?.delete(f)) n++;
    return n;
  }
  async hIncrBy(key: string, field: string, by: number) {
    const m = this.h(key);
    const v = Number(m.get(field) ?? 0) + by;
    m.set(field, String(v));
    return v;
  }
  async del(...keys: string[]) {
    for (const k of keys) {
      this.hashes.delete(k);
      this.zsets.delete(k);
    }
  }
  async zAdd(key: string, ...members: { member: string; score: number }[]) {
    const { m, o } = this.z(key);
    let added = 0;
    for (const { member, score } of members) {
      if (!m.has(member)) {
        added++;
        o.set(member, this.seq++);
      }
      m.set(member, score);
    }
    return added;
  }
  async zIncrBy(key: string, member: string, by: number) {
    const { m, o } = this.z(key);
    if (!m.has(member)) o.set(member, this.seq++);
    const v = (m.get(member) ?? 0) + by;
    m.set(member, v);
    return v;
  }
  async zRem(key: string, members: string[]) {
    const { m } = this.z(key);
    let n = 0;
    for (const x of members) if (m.delete(x)) n++;
    return n;
  }
  /** Rank range only (what the app uses). Redis orders equal scores by member, lexicographically. */
  async zRange(key: string, start: number, stop: number, opts: ZOpts) {
    if (opts.by !== 'rank') throw new Error('fake supports by: rank only');
    const { m } = this.z(key);
    const rows = [...m.entries()].map(([member, score]) => ({ member, score }));
    rows.sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0));
    if (opts.reverse) rows.reverse();
    const end = stop < 0 ? rows.length + stop : stop;
    return rows.slice(start, end + 1);
  }
}
