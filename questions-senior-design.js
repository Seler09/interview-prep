/*
  SENIOR: SYSTEM DESIGN & DISTRIBUTED SYSTEMS
  Format: see the comment at the top of questions.js
*/
addQuestions('senior', [
  // =====================================================================
  // SYSTEM DESIGN
  // =====================================================================
  {
    id: 'sd-framework',
    category: 'System Design',
    difficulty: 2,
    question: 'How do you approach a "design system X" interview question?',
    tldr: 'Drive the conversation through a clear structure: requirements, estimates, API and data model, high-level design, deep dives and trade-offs, talking out loud the whole time.',
    answer: `The interviewer evaluates **how you think**, not whether you draw "the right" diagram. Do not jump into boxes. Use a repeatable structure and time-box it (for a 45-minute interview, roughly 5 / 5 / 10 / 15 / 10 minutes).

**1. Clarify functional requirements (≈5 min)**
- Core use cases: "users can post, follow, see a feed".
- Explicitly agree on what is **out of scope**: "no DMs, no ads".

**2. Non-functional requirements**
- Scale: DAU, requests per second, data volume, read/write ratio.
- Latency targets (p99), availability (99.9% vs 99.99%), durability.
- Consistency needs: can a like count be stale? Can a balance?
- Geography: single region or global.

**3. Back-of-the-envelope estimates**
\`\`\`text
100M DAU × 10 reads/day   = 1B reads/day   ≈ 12k RPS avg (×3 for peak ≈ 35k)
100M DAU × 1 post/day     = 100M writes/day ≈ 1.2k RPS
1 post ≈ 1 KB             → 100 GB/day ≈ 36 TB/year (before replication)
\`\`\`
Order-of-magnitude numbers drive decisions: does it fit in memory? Do we need sharding?

**4. API and data model**
- Key endpoints: \`POST /posts\`, \`GET /feed?cursor=\`.
- Main entities and the **access patterns** that justify the database choice.

**5. High-level design**: client → CDN → load balancer → stateless services → cache → database(s); queues for async work; object storage for media.

**6. Deep dives (the most important part)**: pick the 1–2 hardest problems (fan-out, hot keys, consistency, ID generation) and go deep with alternatives and trade-offs.

**7. Bottlenecks and failure modes**: what happens if the cache, a database or a whole region dies? How do we scale 10×? What do we monitor?

**Signals of seniority**
- You ask about requirements before designing.
- You name trade-offs explicitly ("we choose eventual consistency here because…").
- You start simple and evolve the design; you do not start with 15 microservices.
- You mention operability: monitoring, deployments, data migrations.`,
    followUps: [
      { q: 'How do you estimate storage for 5 years?', a: 'Objects per day × average size × 365 × 5, then multiply by the replication factor (often 3) and add headroom for indexes and growth (≈ 30–50%). State your assumptions out loud.' },
      { q: 'When would you NOT use microservices in such a design?', a: 'When the team is small, the domain is not well understood yet, or scale does not require independent scaling. A modular monolith with clear boundaries is simpler to build, test and operate, and can be split later.' },
    ],
  },
  {
    id: 'sd-url-shortener',
    category: 'System Design',
    difficulty: 2,
    question: 'Design a URL shortener (like bit.ly).',
    tldr: 'It is a read-heavy key-value problem: generate a short unique key (counter + base62 or pre-generated keys), store key → URL in a scalable KV store, and serve redirects from a cache or CDN.',
    answer: `**Requirements**
- Create a short link (optionally a custom alias and expiry), redirect, basic analytics.
- Very **read-heavy** (≈100:1), low-latency redirects, high availability, links must not collide.

**Estimates**: 100M new links/month ≈ 40 writes/s; 4,000 redirects/s on average. 7 base62 characters give 62⁷ ≈ 3.5 trillion keys, which is plenty.

**Key generation options**
1. **Counter + base62**: unique, no collisions. Needs a distributed ID source: DB sequence, Snowflake-style IDs, or ID ranges leased to each app server. Downside: sequential keys are guessable (you can add a reversible shuffle or encryption).
2. **Hash of the URL** (MD5/SHA → first 7 chars): the same URL gets the same key, but collisions must be detected and retried.
3. **Key Generation Service**: pre-generate random keys offline and hand them out in batches. Fast and collision-free, but one more component to run.

\`\`\`js
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function toBase62(n) {          // n: BigInt or safe integer
  let s = '';
  do { s = ALPHABET[n % 62] + s; n = Math.floor(n / 62); } while (n > 0);
  return s;
}
toBase62(125_000_000_000); // "2cVjp0i" (7 chars)
\`\`\`

**Storage**: a simple key-value model (\`short_key → long_url, created_at, expires_at, owner\`). DynamoDB or Cassandra scale horizontally; Postgres works fine for a long time at this write rate.

**Read path**
\`\`\`text
Client → CDN/edge → LB → Redirect service → Redis (cache-aside) → DB
\`\`\`
- Cache the hottest keys (an LRU cache with 20% of keys covers most traffic).
- **301 vs 302**: 301 (permanent) is cached by browsers, giving less load but losing analytics on repeat clicks. 302 (or 307) sends every click through you, giving full analytics.

**Analytics**: never block the redirect. Publish a click event to Kafka and aggregate asynchronously (stream processor → OLAP store like ClickHouse).

**Other concerns**: abuse (phishing or malware URL scanning, rate limits per user), custom aliases (uniqueness check), expiry (TTL plus a lazy check on read), and 404 caching for non-existent keys.`,
    followUps: [
      { q: 'How do you handle a link that suddenly gets millions of clicks?', a: 'Serve it from the CDN edge and in-process caches; Redis replicas or key replication spread the hot key; analytics events are batched. The redirect path should never touch the DB for a hot key.' },
      { q: '301 or 302: which would you choose?', a: 'If analytics matter (they usually do for a shortener), 302/307 so every click hits your service. If the goal is minimal load and links never change, 301.' },
    ],
  },
  {
    id: 'sd-rate-limiter',
    category: 'System Design',
    difficulty: 3,
    question: 'Design a rate limiter for an API.',
    tldr: 'Use a token bucket (or sliding window counter) keyed by user/API key, stored in Redis and updated atomically with a Lua script, enforced at the gateway, returning 429 with Retry-After.',
    answer: `**Where**: in the API gateway or a middleware, before expensive work. The key can be user ID, API key, IP, or a combination (per endpoint, per plan).

**Algorithms**
- **Token bucket**: the bucket holds up to N tokens and refills at R tokens/s; a request takes one token. Allows short **bursts** with a steady average. Most popular (AWS, Stripe).
- **Leaky bucket**: requests drain at a constant rate. Smooths traffic and suits shaping outbound calls.
- **Fixed window counter**: count per minute. Simple, but allows up to 2× the limit at window boundaries.
- **Sliding window log**: store each timestamp. Exact, but memory-heavy.
- **Sliding window counter**: weighted mix of the current and previous window. Accurate enough and cheap.

**Distributed implementation**: all gateway instances share state in **Redis**. The read-modify-write must be **atomic**, otherwise concurrent requests race, so use a Lua script:

\`\`\`lua
-- token bucket: KEYS[1]=bucket key, ARGV: capacity, refill_per_sec, now_ms
local cap, rate, now = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + (now - ts) / 1000 * rate)   -- refill
local allowed = tokens >= 1
if allowed then tokens = tokens - 1 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(cap / rate * 1000))
return allowed and 1 or 0
\`\`\`

**Response**: \`429 Too Many Requests\` with \`Retry-After\`, plus informative headers (\`RateLimit-Limit\`, \`RateLimit-Remaining\`, \`RateLimit-Reset\`).

**Scale and resilience**
- Very high traffic: keep a local in-memory limiter per instance and sync to Redis periodically. Slightly less precise, much less latency.
- **Redis down?** Choose **fail-open** (let traffic through, risk overload) or **fail-closed** (reject everything). Usually fail-open combined with a coarse local limit.
- Multi-region: per-region limits (limit / regions) or async replication of counters, accepting some inaccuracy.
- Different limits per plan, plus separate limits for expensive endpoints.`,
    followUps: [
      { q: 'Why not just INCR + EXPIRE?', a: 'That implements a fixed window, which is fine for simple cases, but it allows bursts of 2× at boundaries. And if INCR and EXPIRE are separate calls, a crash between them leaves a key without TTL. Use a Lua script or `SET key 0 EX 60 NX` + `INCR`.' },
      { q: 'How would you rate limit across multiple regions?', a: 'Split the budget per region (simple, slightly unfair), or replicate counters asynchronously and accept small overshoot. Strong global consistency would add cross-region latency to every request, which is rarely worth it.' },
    ],
  },
  {
    id: 'sd-news-feed',
    category: 'System Design',
    difficulty: 3,
    question: 'Design a news feed (Twitter / Facebook style).',
    tldr: 'The core decision is fan-out: push posts to followers\' feed caches on write for normal users, pull at read time for celebrities, and merge both when the feed is read.',
    answer: `**Requirements**: publish posts, follow users, read a home feed (reverse-chronological or ranked), low read latency; feed reads vastly outnumber writes.

**Fan-out on write (push)**
- On publish, a worker inserts the post ID into each follower's **precomputed feed** (a Redis list or sorted set capped at ~500–1000 IDs).
- Reads are very fast: one cache lookup plus hydration.
- Problem: a celebrity with 50M followers means 50M writes per post (the "hot user" problem). It is also wasted work for inactive followers.

**Fan-out on read (pull)**
- At read time, fetch recent posts from everyone you follow and merge them (k-way merge).
- Cheap writes, but slow and expensive reads, especially for users following thousands.

**Hybrid (what real systems do)**
- Push for normal accounts.
- Pull for accounts above a follower threshold.
- On read: take the precomputed feed, merge in recent posts from followed celebrities, rank, and paginate.
- Skip fan-out for inactive users; build their feed lazily when they return.

\`\`\`text
POST /posts → Post Service → DB + Kafka "post_created"
                                  ↓
                      Fan-out workers ── Social Graph Service (followers)
                                  ↓
                      Redis: feed:{userId} = ZSET(postId, timestamp)
GET /feed → Feed Service → Redis feed + celebrity posts → hydrate (post cache) → rank → page
\`\`\`

**Details worth mentioning**
- **Cursor pagination** (\`?cursor=<lastPostId|timestamp>\`), not \`OFFSET\`: stable when new posts arrive and does not get slower deeper in.
- **Hydration**: the feed stores IDs only; post bodies and author info come from separate caches (counts can be eventually consistent).
- **Media** lives in object storage and is served via CDN.
- **Ranking**: start chronological; ML ranking is a separate scoring service with features.
- **Deletes and privacy changes**: filter at read time (check post status on hydration) rather than removing from millions of feeds.`,
    followUps: [
      { q: 'How do you handle an account with 50M followers?', a: 'Do not fan out on write. Store their posts once and merge them into followers\' feeds at read time, caching the celebrity\'s recent posts aggressively.' },
      { q: 'Why cursor pagination instead of offset?', a: 'With offset, new posts shift the list, so users see duplicates or miss items, and `OFFSET 10000` makes the DB scan and discard rows. A cursor (last seen ID/timestamp) is stable and uses an index seek.' },
    ],
  },
  {
    id: 'sd-chat',
    category: 'System Design',
    difficulty: 3,
    question: 'Design a chat application (1:1 and group messaging).',
    tldr: 'Clients keep WebSocket connections to stateful chat servers; a presence/session registry routes messages between servers, messages are persisted first with per-conversation ordering, then pushed, with ACKs and offline sync.',
    answer: `**Requirements**: 1:1 and group chats, online presence, delivery and read receipts, message history, offline delivery (push notifications), multi-device.

**Connections**
- **WebSocket** for bidirectional, low-latency messaging (fallback: long polling).
- Chat servers are **stateful**: they hold open connections. Track \`userId → serverId\` (per device) in a session registry (Redis).
- Load balancer with long-lived connection support; clients reconnect with backoff and resync on failure.

**Sending a message**
1. Client sends \`{clientMsgId, conversationId, body}\` over its socket.
2. The server **persists first** (durability) and assigns a server-side, per-conversation **monotonic sequence number**.
3. ACK to the sender (\`clientMsgId → seq\`), which lets the client deduplicate retries (idempotency).
4. Route to recipients: look up their servers in the registry and deliver via pub/sub (Redis or Kafka topic per server). Offline recipients get a push notification.
5. Recipients ACK delivery and later send "read up to seq N" receipts.

**Ordering**: global ordering is impossible and unnecessary. Order **per conversation** using the sequence number; clients sort by it and detect gaps.

**Storage**
- Write-heavy, with "last N messages of a conversation" as the main access pattern. A wide-column store fits well: partition key \`conversation_id\`, clustering key \`seq\` (Cassandra, ScyllaDB, HBase).
- Attachments go to object storage + CDN; the message holds a reference.

**Sync and multi-device**: each device stores its last seen \`seq\` per conversation and calls \`GET /sync?since=\` on reconnect.

**Presence**: heartbeats every ~30 s with a TTL key; do not broadcast every presence change to large groups (fetch lazily or batch).

**Groups**: small groups fan out on write to each member. Very large channels behave more like a feed: members pull.

**Extras**: end-to-end encryption (Signal protocol) means the server cannot search or moderate content; rate limiting and spam detection; message edits and deletes as new events.`,
    followUps: [
      { q: 'How do you avoid duplicate messages when the client retries?', a: 'The client generates a `clientMsgId` (UUID). The server stores it with a unique constraint per conversation and returns the existing seq if it sees the same ID again.' },
      { q: 'What does end-to-end encryption break?', a: 'Server-side search, content moderation, link previews generated on the server, and easy multi-device history (keys must be shared between devices). You trade product features for privacy.' },
    ],
  },
  {
    id: 'sd-caching',
    category: 'System Design',
    difficulty: 2,
    question: 'What caching strategies do you know and what problems do they bring?',
    tldr: 'The main patterns are cache-aside, read-through, write-through and write-behind; the hard parts are invalidation, stampedes, hot keys and cache penetration.',
    answer: `**Where to cache**: browser → CDN → reverse proxy → application (in-process) → distributed cache (Redis/Memcached) → database buffer pool.

**Patterns**
- **Cache-aside (lazy loading)**: the app checks the cache; on a miss it reads the DB and populates the cache. Most common; the cache contains only what is requested.
- **Read-through**: the cache library or service loads from the DB itself on a miss.
- **Write-through**: writes go to cache and DB synchronously. The cache is always fresh, writes are slower, and it may cache data nobody reads.
- **Write-behind (write-back)**: write to the cache, flush to the DB asynchronously. Very fast writes, but data is lost if the cache dies.
- **Refresh-ahead**: refresh popular keys before they expire.

\`\`\`js
// cache-aside with stampede protection (single-flight per key)
const inFlight = new Map();
async function getUser(id) {
  const key = \`user:\${id}\`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  if (inFlight.has(key)) return inFlight.get(key);      // join the pending load
  const p = (async () => {
    const user = await db.users.findById(id);
    const ttl = 300 + Math.floor(Math.random() * 60);    // jitter avoids synchronized expiry
    await redis.set(key, JSON.stringify(user ?? null), 'EX', user ? ttl : 30); // cache "not found" briefly
    return user;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

// on update: write to DB, then DELETE the key (do not SET it)
async function updateUser(id, data) {
  await db.users.update(id, data);
  await redis.del(\`user:\${id}\`);
}
\`\`\`

**Problems and fixes**
- **Invalidation**: TTLs as a safety net, explicit delete on write, or change-data-capture events (Debezium) to invalidate. **Delete rather than update** on write: two concurrent writers updating the cache can leave the older value there.
- **Cache stampede / thundering herd**: a hot key expires and thousands of requests hit the DB. Fixes: single-flight/locking, probabilistic early refresh, stale-while-revalidate, TTL jitter.
- **Hot keys**: one key gets enormous traffic. Fixes: an in-process L1 cache, replicating the key under several names, read replicas.
- **Cache penetration**: requests for keys that do not exist bypass the cache every time. Fixes: cache negative results with a short TTL, Bloom filters.
- **Consistency**: a cache is a copy, so decide how stale data may be per use case.
- **Eviction policies**: LRU, LFU, TTL-based. Watch memory and eviction metrics.`,
    followUps: [
      { q: 'Why delete the cache key on update instead of setting the new value?', a: 'With two concurrent updates, the writes to DB and cache can interleave so the cache ends up with the older value forever (until TTL). Deleting forces the next read to load the current DB value. A small race remains (read old value, then write it back after delete), which is why TTLs or delayed double-delete are used as a backstop.' },
      'How do you keep a two-level cache (in-process L1 + Redis L2) consistent?',
    ],
  },
  {
    id: 'sd-scaling-db',
    category: 'System Design',
    difficulty: 3,
    question: 'Your database can no longer keep up. How do you scale it, step by step?',
    tldr: 'Go from cheapest to most complex: fix queries and indexes, scale vertically, add caching and read replicas, partition and archive, split by domain, and shard only as a last resort.',
    answer: `1. **Diagnose first**: is it CPU, I/O, locks, connections or a few bad queries? Use \`pg_stat_statements\` / the slow query log, \`EXPLAIN ANALYZE\`, missing indexes, N+1 queries, and connection pool saturation. Often 80% of the load comes from a handful of queries.
2. **Vertical scaling**: a bigger machine, faster disks, more RAM so the working set fits in memory. Simple and surprisingly far-reaching, but it has a ceiling and costs grow non-linearly.
3. **Caching**: put Redis in front of hot, rarely changing reads, or materialised views for expensive aggregates.
4. **Read replicas**: route reads to replicas. Watch out for **replication lag**: a user who just saved something and then reads from a replica may not see it. Solutions: read-your-writes routing (read from the primary for a few seconds after a write, or until the replica has caught up to the write's LSN).
5. **Partitioning within one database** (e.g. by month) plus **archiving** cold data: smaller indexes and cheap deletion of old partitions.
6. **Functional split**: separate databases per bounded context or service (orders, catalog, users).
7. **Sharding**: split one logical table across many database instances by a **shard key**.
   - Choose the key so data is evenly distributed **and** most queries hit one shard (e.g. \`tenant_id\`, \`user_id\`).
   - Hash sharding spreads data evenly; range sharding keeps ranges together but risks hotspots.
   - Costs: no cross-shard joins or transactions, resharding is hard, global unique IDs (Snowflake), fan-out queries for global lookups, more operational burden.
   - Alternatives: Citus, Vitess, or distributed SQL (CockroachDB, Spanner, YugabyteDB) do this for you.

\`\`\`sql
-- PostgreSQL declarative partitioning (step 5)
CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL,
  payload jsonb
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_11 PARTITION OF events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
-- dropping a month of data is instant: DROP TABLE events_2025_11;
\`\`\``,
    followUps: [
      { q: 'How do you reshard without downtime?', a: 'Use consistent hashing or many logical shards mapped to fewer physical nodes, so you move whole logical shards. The process: double-write (or CDC) to the new location, backfill, verify, switch reads, then switch writes, then clean up. Tools like Vitess automate it.' },
      { q: 'How do you guarantee read-your-writes with replicas?', a: 'Route a user\'s reads to the primary for a short window after they write, or track the write\'s log position (LSN/GTID) and read from a replica only once it has replayed past that position.' },
    ],
  },
  {
    id: 'sd-consistent-hashing',
    category: 'System Design',
    difficulty: 3,
    question: 'What is consistent hashing and why is it used?',
    tldr: 'Consistent hashing maps keys and nodes onto the same ring so that adding or removing a node only moves about K/N keys instead of reshuffling almost everything.',
    answer: `**The problem with modulo**: \`node = hash(key) % N\`. Change N from 4 to 5 and about 80% of keys move to a different node: a cache cold-start or massive data migration.

**Consistent hashing**
- Hash both **nodes** and **keys** onto a ring (e.g. 0 … 2³²−1).
- A key belongs to the **first node clockwise** from its position.
- Adding a node takes over only the keys between it and its predecessor; removing one hands its keys to the next node. On average only **K/N** keys move.

**Virtual nodes (vnodes)**: each physical node is placed on the ring many times (100–200 points).
- Much more even distribution (avoids one node owning a huge arc).
- When a node dies, its load spreads across many nodes, not just one neighbour.
- Stronger machines can get more vnodes (weighting).

\`\`\`js
const crypto = require('crypto');
const h = s => parseInt(crypto.createHash('md5').update(s).digest('hex').slice(0, 8), 16);

class HashRing {
  constructor(vnodes = 100) { this.vnodes = vnodes; this.ring = []; } // sorted [hash, node]
  add(node) {
    for (let i = 0; i < this.vnodes; i++) this.ring.push([h(\`\${node}#\${i}\`), node]);
    this.ring.sort((a, b) => a[0] - b[0]);
  }
  remove(node) { this.ring = this.ring.filter(([, n]) => n !== node); }
  get(key) {
    const kh = h(key);
    let lo = 0, hi = this.ring.length;            // binary search: first point >= kh
    while (lo < hi) { const mid = (lo + hi) >> 1; this.ring[mid][0] < kh ? lo = mid + 1 : hi = mid; }
    return this.ring[lo % this.ring.length][1];   // wrap around the ring
  }
}
\`\`\`

**Used in**: distributed caches (Memcached clients), Cassandra and DynamoDB partitioning, load balancers with session affinity, CDNs.

**Replication**: store each key on the next R distinct nodes clockwise.

**Alternatives**
- **Rendezvous (HRW) hashing**: each key picks the node with the highest \`hash(key, node)\`. Simple, no ring, even distribution.
- **Jump consistent hash** (Google): tiny, fast, no memory, but nodes can only be added or removed at the end.`,
  },
  {
    id: 'sd-queues',
    category: 'System Design',
    difficulty: 2,
    question: 'When and why do you use a message queue? Kafka vs RabbitMQ?',
    tldr: 'Queues decouple services, absorb traffic spikes and enable async processing and retries; RabbitMQ is a smart broker for task queues and routing, Kafka is a durable, replayable, partitioned log for event streaming.',
    answer: `**Why a queue**
- **Asynchronous work**: respond to the user immediately and send the email or generate the PDF in the background.
- **Decoupling**: the producer does not know or wait for consumers; services can be down temporarily.
- **Load levelling**: buffer spikes so consumers process at their own pace.
- **Fan-out**: one event, many independent consumers.
- **Retries** and dead-letter handling.

**RabbitMQ (classic message broker)**
- Exchanges and routing (direct, topic, fanout, headers): flexible routing logic.
- Messages are **removed after acknowledgement**; the broker pushes them to consumers.
- Per-message ACK/NACK, priorities, TTLs, DLX (dead-letter exchanges).
- Great for **task/work queues** and complex routing at moderate throughput.

**Kafka (distributed commit log)**
- Topics split into **partitions**; messages are **retained** for a configured time, independent of consumption.
- Consumers track their own **offset**, so you can **replay** history and add new consumers later.
- **Ordering is guaranteed only within a partition**, so use a key (e.g. \`orderId\`) to keep related events in order.
- Consumer groups: each partition is processed by exactly one consumer in the group, which caps parallelism at the partition count.
- Huge throughput. Great for **event streaming**, event sourcing, CDC and analytics pipelines.

**Delivery semantics**
- At-most-once: may lose messages.
- **At-least-once**: the usual default; may deliver **duplicates**, so **consumers must be idempotent**.
- Exactly-once: possible within Kafka (idempotent producer + transactions), but end-to-end it still requires idempotent side effects.

\`\`\`js
// idempotent consumer: remember processed message IDs in the same transaction as the effect
async function handle(msg) {
  await db.tx(async t => {
    const fresh = await t.query(
      'INSERT INTO processed_messages(id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id', [msg.id]);
    if (fresh.rowCount === 0) return;           // duplicate: already handled
    await t.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [msg.amount, msg.accountId]);
  });
}
\`\`\`

**Operational concerns**: poison messages → retries with backoff, then a **DLQ**; monitor **consumer lag**; schema evolution (Avro/Protobuf + schema registry); backpressure.`,
    followUps: [
      { q: 'How do you guarantee ordering of events for one customer in Kafka?', a: 'Use the customer ID as the message key so all their events go to the same partition, and process each partition sequentially. Be careful with retries that re-order (use idempotent producers and `max.in.flight` settings).' },
      { q: 'What do you do with a message that crashes the consumer every time?', a: 'Retry a limited number of times with backoff, then move it to a dead-letter queue with error metadata, alert, and keep processing the rest. Fix and replay from the DLQ later.' },
    ],
  },
  {
    id: 'sd-file-upload',
    category: 'System Design',
    difficulty: 2,
    question: 'How do you design uploading of large files (e.g. multi-GB videos)?',
    tldr: 'Never stream big files through your API: issue presigned URLs, let the client upload directly to object storage in resumable multipart chunks, then process asynchronously via events and serve through a CDN.',
    answer: `**1. Direct-to-storage upload**
- The client asks your API to start an upload. The API authorises it, creates a DB record (status \`UPLOADING\`) and returns **presigned URLs** for S3/GCS.
- The client uploads **directly** to object storage. Your servers never carry the bytes, which saves bandwidth, memory and timeouts.

\`\`\`js
// Node + AWS SDK v3: presigned URL for one part of a multipart upload
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({});
const { UploadId } = await s3.send(new CreateMultipartUploadCommand({ Bucket, Key }));
const urlForPart = n => getSignedUrl(s3,
  new UploadPartCommand({ Bucket, Key, UploadId, PartNumber: n }), { expiresIn: 3600 });
// client PUTs each chunk to its URL, then the API calls CompleteMultipartUpload with the ETags
\`\`\`

**2. Multipart / chunked and resumable**
- Split into parts (e.g. 10–100 MB), upload in parallel, and retry only failed parts.
- Resume after a network drop or app restart (track uploaded parts). The tus protocol is an open standard for this.
- Checksums per part for integrity.

**3. Asynchronous processing**
- An object-created event (S3 notification → SQS/Kafka) triggers workers: virus scan, content validation (check magic bytes, not the extension), metadata extraction, **transcoding** to several resolutions, thumbnails.
- Status in the DB: \`UPLOADED → PROCESSING → READY / FAILED\`; the client polls or gets a WebSocket/webhook notification.

**4. Delivery**
- Serve via **CDN**; for video use adaptive streaming (**HLS/DASH**) with segments in multiple bitrates.
- Private content: signed CDN URLs or cookies with short expiry.

**5. Housekeeping**
- Size limits and quotas, rate limits.
- A lifecycle policy to abort incomplete multipart uploads and delete orphans.
- Storage tiers for old content (cold storage).`,
  },

  // =====================================================================
  // DISTRIBUTED SYSTEMS
  // =====================================================================
  {
    id: 'ds-cap',
    category: 'Distributed Systems',
    difficulty: 2,
    question: 'Explain the CAP theorem and PACELC.',
    tldr: 'During a network partition a distributed system must choose between consistency and availability (CAP); PACELC adds that even without partitions you trade latency against consistency.',
    answer: `**CAP**
- **C (Consistency / linearizability)**: every read sees the most recent write, or returns an error.
- **A (Availability)**: every request to a non-failed node gets a (non-error) response, possibly stale.
- **P (Partition tolerance)**: the system keeps working despite lost or delayed messages between nodes.

Network partitions **will** happen, so P is not optional. The real choice is: **when a partition happens, do you sacrifice C or A?**
- **CP**: refuse or fail some requests to stay consistent (e.g. a minority partition stops accepting writes). Examples: ZooKeeper, etcd, HBase, systems built on Raft/Paxos.
- **AP**: keep answering on both sides of the partition and reconcile later (conflicts resolved by last-write-wins, CRDTs or app logic). Examples: Cassandra and DynamoDB in their default configurations, DNS.

A "CA" distributed system does not really exist; it just means "we hope partitions never happen".

**PACELC**: **if P**artition → choose **A** or **C**; **E**lse (normal operation) → choose **L**atency or **C**onsistency.
Strong consistency requires coordination (synchronous replication, quorum reads), which costs latency on **every** request, not just during failures.
- DynamoDB / Cassandra: PA/EL (tunable).
- Spanner, CockroachDB: PC/EC.
- MongoDB (majority read/write concerns): PC/EC; with weaker settings it can behave more like PA/EL.

**Quorums (tunable consistency)**: with N replicas, write to W and read from R. If **R + W > N**, read and write sets overlap, so reads see the latest write (assuming no sloppy quorums). E.g. N=3, W=2, R=2.

**Business framing (what seniors do)**: choose per operation. A shopping cart or like counter → AP is fine. Account balance, inventory reservation, unique username → CP.`,
    followUps: [
      { q: 'Give a business example where you would choose AP and one where you would choose CP.', a: 'AP: social feed, product reviews, view counters (stale data is acceptable, downtime is not). CP: payments, seat booking, unique username registration (double-spending or overbooking is unacceptable).' },
    ],
  },
  {
    id: 'ds-consistency-models',
    category: 'Distributed Systems',
    difficulty: 3,
    question: 'What consistency models do you know?',
    tldr: 'From strongest to weakest: linearizability, sequential, causal, session guarantees (read-your-writes, monotonic reads) and eventual consistency. Stronger means simpler reasoning but higher latency and lower availability.',
    answer: `**Linearizability (strong consistency)**
Every operation appears to take effect atomically at a single point between its start and end, consistent with **real time**. Once a write completes, every later read sees it. Behaves like a single copy. Required for locks, leader election and unique constraints. Expensive: needs consensus or quorum coordination.

**Sequential consistency**
All nodes see operations in the **same order**, and each client's operations appear in program order, but that order need not match wall-clock time.

**Causal consistency**
Operations that are causally related (a reply after the post it answers) are seen in that order by everyone; concurrent, unrelated operations may be seen in different orders. Achievable while staying available during partitions. Implemented with vector clocks or dependency tracking.

**Session guarantees (client-centric)**
- **Read-your-writes**: you always see your own updates.
- **Monotonic reads**: you never see data go "back in time".
- **Monotonic writes**: your writes are applied in order.
- **Writes-follow-reads**.
These fix most user-visible weirdness even on top of eventually consistent stores (e.g. sticky sessions to one replica, or tracking a version token).

**Eventual consistency**
If writes stop, all replicas eventually converge. No guarantee about what you read in the meantime. Needs a conflict-resolution strategy: last-write-wins (can lose data), vector clocks with app-level merge, or **CRDTs** (data types that merge automatically, e.g. counters and sets).

**Practical guidance**
- Pick per use case: balance → strong; profile picture → eventual; comments → causal or session.
- In databases: isolation levels (single-node concurrency) and consistency models (replication) are related but different concepts. Do not mix them up in an interview.`,
  },
  {
    id: 'ds-saga',
    category: 'Distributed Systems',
    difficulty: 3,
    question: 'How do you handle a "transaction" that spans several microservices? 2PC vs Saga.',
    tldr: '2PC gives atomicity but blocks and couples services, so microservices usually use Sagas: a sequence of local transactions with compensating actions, orchestrated or choreographed, accepting eventual consistency.',
    answer: `**Two-phase commit (2PC)**
1. Prepare: the coordinator asks all participants to prepare (lock resources, vote yes/no).
2. Commit: if everyone voted yes, commit; otherwise abort.

Problems: participants **hold locks** while waiting; if the coordinator dies after prepare, participants are stuck (blocking protocol); it needs XA support across very different systems (DBs, brokers, third-party APIs usually do not support it); throughput and availability suffer. Rarely used across microservices.

**Saga**: a business transaction modelled as a series of **local transactions**, each committing in its own service. If step N fails, run **compensating transactions** for steps N−1 … 1.

Example: order placement
1. Order Service: create order (PENDING)
2. Payment Service: charge card → compensation: refund
3. Inventory Service: reserve items → compensation: release reservation
4. Shipping Service: schedule delivery
5. Order Service: mark CONFIRMED (or CANCELLED after compensations)

**Choreography**: services react to each other's events (\`PaymentCompleted\` → inventory reserves). Loosely coupled, but the flow is implicit and hard to follow or debug as it grows; watch out for cyclic dependencies.

**Orchestration**: a central orchestrator (a state machine) tells each service what to do and handles failures. The flow is explicit, easy to monitor and change. Tools: Temporal, Camunda, AWS Step Functions.

\`\`\`ts
// orchestration sketch (Temporal-style workflow: durable, retried, resumable)
async function placeOrderSaga(order: Order) {
  const compensations: Array<() => Promise<void>> = [];
  try {
    const payment = await activities.chargeCard(order);
    compensations.push(() => activities.refund(payment.id));

    const reservation = await activities.reserveStock(order);
    compensations.push(() => activities.releaseStock(reservation.id));

    await activities.scheduleShipping(order);
    await activities.confirmOrder(order.id);
  } catch (err) {
    for (const undo of compensations.reverse()) await undo(); // must be idempotent + retried
    await activities.cancelOrder(order.id, String(err));
  }
}
\`\`\`

**Design rules**
- Sagas give **ACD without I**: other transactions can see intermediate states. Use semantic states (PENDING) and countermeasures (e.g. semantic locks).
- Compensations and steps must be **idempotent** and retryable.
- Some actions cannot be undone (an email sent). Put them **last** ("pivot" step), or compensate semantically (send a correction).
- Publish events reliably with the **outbox pattern**.`,
    followUps: [
      { q: 'What if a compensation fails too?', a: 'Retry it with backoff (compensations must be idempotent). If it keeps failing, park the saga in a failed state, alert and handle it manually or with a reconciliation job. Durable workflow engines persist saga state so nothing is forgotten after a crash.' },
      { q: 'How do you reliably publish an event after saving to the DB?', a: 'The transactional outbox pattern: write the event to an outbox table in the same local transaction, and relay it to the broker asynchronously (poller or CDC).' },
    ],
  },
  {
    id: 'ds-outbox',
    category: 'Distributed Systems',
    difficulty: 3,
    question: 'What is the Transactional Outbox pattern and what problem does it solve?',
    tldr: 'It solves the dual-write problem: you write the business change and the event into the same database transaction, and a separate relay publishes events from the outbox table to the broker, giving at-least-once delivery.',
    answer: `**The dual-write problem**
\`\`\`js
await db.orders.insert(order);          // 1. commit to DB
await kafka.send('order_created', ev);  // 2. publish: what if this fails, or the process dies here?
\`\`\`
There is no shared transaction between the DB and the broker. Either order of operations can leave you inconsistent: an order without an event (downstream never knows), or an event for an order that was rolled back.

**Outbox pattern**
1. In the **same local transaction** as the business change, insert the event into an \`outbox\` table.
2. A separate **relay** reads unpublished outbox rows, publishes them to the broker, then marks them as sent (or deletes them).

\`\`\`sql
BEGIN;
INSERT INTO orders (id, customer_id, total, status) VALUES ($1, $2, $3, 'PLACED');
INSERT INTO outbox (id, aggregate_type, aggregate_id, type, payload)
VALUES (gen_random_uuid(), 'order', $1, 'OrderPlaced', $4::jsonb);
COMMIT;

-- polling relay (safe with several relay instances thanks to SKIP LOCKED)
SELECT * FROM outbox
WHERE published_at IS NULL
ORDER BY created_at
LIMIT 100
FOR UPDATE SKIP LOCKED;
-- publish each row, then: UPDATE outbox SET published_at = now() WHERE id = ANY($ids);
\`\`\`

**Relay options**
- **Polling publisher**: simple; adds some latency and DB load.
- **Change Data Capture (CDC)**: Debezium tails the WAL/binlog and streams outbox inserts to Kafka. Low latency, no polling, but more infrastructure.

**Guarantees and consequences**
- Delivery is **at-least-once**: the relay can crash after publishing but before marking. **Consumers must be idempotent** (the inbox pattern: store processed event IDs).
- Ordering: publish in outbox order per aggregate (partition key = aggregate ID).
- Clean up old outbox rows (partitioning or a periodic delete).

**Inbox pattern** (the mirror image): a consumer stores the incoming message ID in an \`inbox\`/\`processed_messages\` table in the same transaction as its side effects, so duplicates are ignored.`,
  },
  {
    id: 'ds-idempotency',
    category: 'Distributed Systems',
    difficulty: 2,
    question: 'How do you design an idempotent API (e.g. for payments)?',
    tldr: 'The client sends a unique Idempotency-Key; the server atomically records it, performs the operation once, stores the response, and returns the stored response for any retry with the same key.',
    answer: `**Why**: networks fail. The client sends "charge $100", the request times out, and the client does not know whether it succeeded. It must retry, and without idempotency the customer is charged twice.

**Protocol (Stripe-style)**
1. The client generates a unique key (UUID v4) per logical operation and sends \`Idempotency-Key: <uuid>\`. Retries reuse the same key.
2. The server tries to **atomically insert** the key (unique constraint), with a fingerprint of the request.
3. Cases:
   - **New key** → process the operation, store status code + body with the key, return the response.
   - **Key exists and completed** → return the **stored** response; do not run it again.
   - **Key exists, in progress** → return \`409 Conflict\` (or wait), because a concurrent retry is running.
   - **Same key, different request body** → \`422\` (client bug).
4. Keys expire after e.g. 24 hours.

\`\`\`sql
CREATE TABLE idempotency_keys (
  key           text PRIMARY KEY,
  user_id       bigint NOT NULL,
  request_hash  text NOT NULL,
  status        text NOT NULL DEFAULT 'in_progress',  -- in_progress | completed
  response_code int,
  response_body jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
\`\`\`

\`\`\`js
async function createPayment(req, res) {
  const key = req.get('Idempotency-Key');
  const hash = sha256(JSON.stringify(req.body));
  const inserted = await db.query(
    \`INSERT INTO idempotency_keys(key, user_id, request_hash) VALUES ($1,$2,$3)
     ON CONFLICT (key) DO NOTHING RETURNING key\`, [key, req.user.id, hash]);

  if (inserted.rowCount === 0) {                       // we have seen this key before
    const row = await db.one('SELECT * FROM idempotency_keys WHERE key = $1', [key]);
    if (row.request_hash !== hash) return res.status(422).send('Key reused with different payload');
    if (row.status !== 'completed') return res.status(409).send('Request in progress');
    return res.status(row.response_code).json(row.response_body);
  }

  const payment = await payments.charge(req.body, { idempotencyKey: key }); // pass it downstream too
  await db.query(\`UPDATE idempotency_keys SET status='completed', response_code=201, response_body=$2
                  WHERE key=$1\`, [key, payment]);
  res.status(201).json(payment);
}
\`\`\`

**Subtleties**
- Crash mid-processing: the key stays \`in_progress\`. Use a lock timeout, or make internal steps idempotent too and allow a retry to resume.
- Pass the key **downstream** (payment provider, internal services) so the whole chain is idempotent.
- Natural idempotency is even better when possible: \`PUT\` with a client-generated ID, or "set status to X" instead of "toggle".`,
    followUps: [
      { q: 'What happens if the server crashes in the middle of processing?', a: 'The key remains `in_progress`. After a timeout, a retry may take over; to make that safe, each internal step must itself be idempotent (e.g. the payment provider call uses the same key, and DB writes use unique constraints). Alternatively, store the full result atomically in the same transaction as the business change.' },
    ],
  },
  {
    id: 'ds-resilience',
    category: 'Distributed Systems',
    difficulty: 2,
    question: 'What resilience patterns do you use for service-to-service communication?',
    tldr: 'Timeouts everywhere, retries with exponential backoff and jitter only for idempotent calls, circuit breakers, bulkheads, fallbacks and load shedding, so one slow dependency cannot take down everything.',
    answer: `**Timeouts**: every network call needs one. Without them, threads and connections pile up waiting for a dead dependency, and the failure cascades upstream. Set them from measured latency (e.g. slightly above p99.9), and propagate **deadlines** through the call chain (gRPC deadlines).

**Retries with exponential backoff + jitter**
- Retry only **transient** errors (timeouts, 503, connection resets), not 4xx.
- Retry only **idempotent** operations (or ones with idempotency keys).
- **Jitter** prevents thousands of clients retrying in sync and hammering the service when it recovers.

\`\`\`js
async function withRetry(fn, { retries = 4, baseMs = 100, maxMs = 5000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const transient = err.code === 'ETIMEDOUT' || err.status === 503 || err.status === 429;
      if (!transient || attempt >= retries) throw err;
      const cap = Math.min(maxMs, baseMs * 2 ** attempt);
      const delay = Math.random() * cap;                 // "full jitter"
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
\`\`\`

**Circuit breaker**: after too many failures, stop calling the dependency for a while and fail fast (or return a fallback).
\`\`\`js
class CircuitBreaker {
  constructor(fn, { threshold = 5, resetMs = 10_000 } = {}) {
    Object.assign(this, { fn, threshold, resetMs, failures: 0, state: 'CLOSED', openedAt: 0 });
  }
  async call(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt < this.resetMs) throw new Error('Circuit open');
      this.state = 'HALF_OPEN';                          // allow a trial request
    }
    try {
      const res = await this.fn(...args);
      this.failures = 0; this.state = 'CLOSED';
      return res;
    } catch (e) {
      if (++this.failures >= this.threshold || this.state === 'HALF_OPEN') {
        this.state = 'OPEN'; this.openedAt = Date.now();
      }
      throw e;
    }
  }
}
\`\`\`

**Bulkheads**: isolate resources per dependency (separate connection pools or thread pools, concurrency limits), so a slow recommendation service cannot exhaust the threads needed for checkout.

**Fallbacks / graceful degradation**: cached or default data, hide a non-critical widget, queue the request for later.

**Retry budgets**: limit retries to e.g. 10% of traffic. In a chain A → B → C with 3 retries each level, one failure at C can become 27 calls: a **retry storm**. Retry at one layer only, ideally the edge.

**Load shedding and backpressure**: reject excess work early (429/503) instead of queueing until everything times out; prioritise critical traffic.

**Health checks, hedged requests** (send a second request after the p95 latency and take the first response), **idempotency** and **observability** complete the picture. Libraries: resilience4j, Polly, Envoy/Istio for service-mesh-level policies.`,
    followUps: [
      { q: 'What is a retry storm and how do you avoid it in a chain A → B → C?', a: 'Each layer retries independently, so retries multiply (3×3×3 = 27 calls to C for one user request) exactly when C is overloaded. Avoid it by retrying at only one layer, using retry budgets, circuit breakers and backoff with jitter, and returning "do not retry" signals when overloaded.' },
    ],
  },
  {
    id: 'ds-consensus',
    category: 'Distributed Systems',
    difficulty: 3,
    question: 'How does a consensus algorithm like Raft work?',
    tldr: 'Raft elects a single leader per term by majority vote; the leader appends commands to a replicated log and an entry is committed once a majority has stored it, so a cluster of 2f+1 nodes tolerates f failures.',
    answer: `**Goal**: several nodes agree on the same sequence of commands (a replicated log). Applying it to a state machine gives every node the same state, even with crashes and network issues.

**Roles**: **leader**, **followers** and **candidates**. Time is divided into **terms** (monotonically increasing numbers).

**1. Leader election**
- Followers expect periodic heartbeats from the leader.
- If a follower's **randomised election timeout** (e.g. 150–300 ms) expires, it becomes a candidate, increments the term, votes for itself and requests votes.
- A node grants at most one vote per term, and only to a candidate whose log is **at least as up-to-date** as its own (this guarantees the leader has all committed entries).
- A **majority** of votes makes it leader. Randomised timeouts make split votes rare.

**2. Log replication**
- Clients send commands to the leader, which appends them to its log and sends \`AppendEntries\` to followers.
- Once a **majority** has persisted an entry, it is **committed**; the leader applies it and replies to the client, and followers apply it on the next heartbeat.
- Consistency check: each AppendEntries carries the previous entry's index and term; followers reject mismatches and the leader backs up until the logs agree, overwriting divergent uncommitted entries.

**3. Safety and fault tolerance**
- With **2f + 1** nodes you tolerate **f** failures: 3 nodes tolerate 1, 5 tolerate 2. Even counts add cost without adding tolerance.
- A minority partition cannot elect a leader or commit, which is the **CP** choice from CAP.
- Stale leaders discover a higher term and step down.

**In practice** you never implement Raft at work; you **use** systems built on it: etcd (Kubernetes state), Consul, CockroachDB/TiKV, Kafka KRaft, RabbitMQ quorum queues. Typical use cases: leader election, distributed locks with fencing, configuration and service discovery, strongly consistent metadata.

**Paxos** solves the same problem (Raft was designed to be more understandable); **Zab** powers ZooKeeper.`,
  },
  {
    id: 'ds-distributed-lock',
    category: 'Distributed Systems',
    difficulty: 3,
    question: 'How do you implement a distributed lock and what are the pitfalls?',
    tldr: 'Use a lock with a TTL (Redis SET NX PX, or etcd/ZooKeeper leases) and release it only if you still own it, but remember a paused process can outlive its lease, so protect the resource with fencing tokens or avoid locks entirely.',
    answer: `**Redis-based lock**
\`\`\`js
const token = crypto.randomUUID();
// acquire: only if not exists, with a TTL so a crashed owner does not block forever
const ok = await redis.set('lock:invoice:42', token, 'NX', 'PX', 30_000);
if (!ok) throw new Error('Locked by someone else');
try {
  await doWork();
} finally {
  // release ONLY if we still own it: check-and-delete atomically
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1, 'lock:invoice:42', token);
}
\`\`\`
Never use a plain \`DEL\`: if your lock expired and someone else acquired it, you would delete **their** lock.

**The fundamental problem: leases expire while you still think you hold them**
- GC pauses, VM stalls or slow I/O can make process A pause longer than the TTL. The lock expires, B acquires it, then A wakes up and writes as well, and both believe they hold the lock.
- No clock- or TTL-based scheme alone can prevent this.

**Fencing tokens**
- The lock service returns a **monotonically increasing number** with each acquisition (etcd revision, ZooKeeper zxid, or a DB sequence).
- The protected resource **rejects writes with a token lower than the highest it has seen**.
\`\`\`sql
UPDATE documents SET body = $1, fence = $2
WHERE id = $3 AND fence < $2;   -- 0 rows → our lock was stale, abort
\`\`\`

**Options compared**
- **Redis single instance**: fast; fine for **efficiency** locks (avoid duplicate work), not for **correctness** locks.
- **Redlock** (multiple Redis masters): debated (Martin Kleppmann's critique: relies on timing assumptions, no fencing).
- **etcd / ZooKeeper / Consul**: consensus-backed, leases plus fencing via revisions. Use these for correctness.
- **Database locks**: \`SELECT ... FOR UPDATE\`, or PostgreSQL advisory locks (\`pg_try_advisory_lock\`) when everything is in one DB anyway.

**Best option: avoid the lock**
- Idempotent operations, optimistic concurrency (version columns), unique constraints, or single-writer partitioning (route all work for key X to one consumer via a Kafka partition).`,
  },
  {
    id: 'ds-time',
    category: 'Distributed Systems',
    difficulty: 3,
    question: 'Why can\'t you rely on clocks in distributed systems?',
    tldr: 'Physical clocks drift, jump (NTP corrections, leap seconds) and differ between machines, so timestamps cannot reliably order events; use logical clocks, version vectors or bounded-uncertainty time instead.',
    answer: `**What goes wrong**
- Quartz clocks **drift** (milliseconds to seconds per day); NTP corrects them, sometimes by jumping **backwards**.
- Clock skew between machines is usually milliseconds, but can be much more on misconfigured or overloaded hosts.
- VMs pause; leap seconds happen.
- So "last write wins" by wall-clock timestamp can **silently discard** the actually newer write if its node's clock was behind.

**Measuring durations**: use a **monotonic clock** (\`performance.now()\`, \`process.hrtime\`, \`System.nanoTime\`), never wall-clock time, for timeouts and latencies.

**Lamport clocks**: a counter per node.
\`\`\`js
class LamportClock {
  t = 0;
  tick()          { return ++this.t; }                         // local event or before send
  receive(remote) { this.t = Math.max(this.t, remote) + 1; return this.t; }
}
\`\`\`
If A happened-before B, then L(A) < L(B). The reverse is not true: equal or ordered numbers do not tell you whether events were concurrent. With a node-ID tiebreak you get a **total order** consistent with causality.

**Vector clocks**: one counter per node. Comparing two vectors tells you whether one happened before the other or whether they are **concurrent** (a conflict that needs merging). Used by Dynamo-style stores; the vectors grow with the number of nodes (version vectors are a variant).

**Hybrid Logical Clocks (HLC)**: physical time plus a logical counter. Close to wall-clock time but causally consistent; used by CockroachDB and MongoDB.

**TrueTime (Google Spanner)**: GPS and atomic clocks give time as an interval \`[earliest, latest]\` with a known bound (a few ms). Spanner **waits out the uncertainty** before committing, achieving external consistency globally.

**Takeaways**
- Order events with sequence numbers from a single authority (a DB sequence, Kafka partition offsets) where possible.
- Use version numbers for optimistic concurrency, not timestamps.
- Use **CRDTs** when concurrent updates must merge automatically.`,
  },
]);
