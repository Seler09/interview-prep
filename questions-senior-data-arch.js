/*
  SENIOR: DATABASES & ARCHITECTURE
  Format: see the comment at the top of questions.js
*/
addQuestions('senior', [
  // =====================================================================
  // DATABASES (SENIOR)
  // =====================================================================
  {
    id: 'db-isolation-anomalies',
    category: 'Databases (Senior)',
    difficulty: 3,
    question: 'Walk through transaction isolation levels and the anomalies they prevent.',
    tldr: 'Weaker isolation allows dirty reads, non-repeatable reads, phantoms, lost updates and write skew; Read Committed is a common default, Repeatable Read/snapshot isolation fixes most issues, and only Serializable (or explicit locks) prevents write skew.',
    answer: `**Anomalies**
- **Dirty read**: reading another transaction's **uncommitted** changes (which may roll back).
- **Non-repeatable read**: reading the same row twice in a transaction gives different values because someone committed in between.
- **Phantom read**: re-running a range query returns **new rows** inserted by another transaction.
- **Lost update**: two transactions read a value, both modify it in application code, both write, and one update is silently overwritten.
- **Write skew**: two transactions read an overlapping set, then each writes a **different** row based on what they read, violating an invariant neither would violate alone.

**Write skew example: "at least one doctor must be on call"**
\`\`\`sql
-- T1 (Alice) and T2 (Bob) run concurrently under snapshot isolation
SELECT count(*) FROM doctors WHERE on_call = true;  -- both see 2
UPDATE doctors SET on_call = false WHERE name = 'Alice';  -- T1
UPDATE doctors SET on_call = false WHERE name = 'Bob';    -- T2
COMMIT; -- both succeed → nobody is on call
\`\`\`

**Levels (SQL standard) and what they allow**
| Level | Dirty | Non-repeatable | Phantom |
|---|---|---|---|
| Read Uncommitted | yes | yes | yes |
| Read Committed | no | yes | yes |
| Repeatable Read | no | no | yes (standard) |
| Serializable | no | no | no |

**Real databases differ**
- **PostgreSQL**: Read Committed by default; Repeatable Read is **snapshot isolation** (no phantoms either, and lost updates are detected with a serialization error), but write skew is still possible. **Serializable** uses SSI (serializable snapshot isolation) and aborts conflicting transactions, so the application must **retry**.
- **MySQL InnoDB**: Repeatable Read by default, using MVCC snapshots plus gap/next-key locks for locking reads.

**How to prevent lost updates and write skew in practice**
\`\`\`sql
-- 1. Atomic update instead of read-modify-write
UPDATE accounts SET balance = balance - 100 WHERE id = 1 AND balance >= 100;

-- 2. Explicit lock on the rows you base the decision on
SELECT * FROM doctors WHERE shift_id = 7 AND on_call FOR UPDATE;

-- 3. Optimistic concurrency with a version column
UPDATE accounts SET balance = 900, version = version + 1 WHERE id = 1 AND version = 41;

-- 4. Constraints (unique, exclusion, check) and Serializable + retry loop
\`\`\``,
    followUps: [
      { q: 'How would you prevent a lost update when changing a balance?', a: 'Avoid read-modify-write in the app: use an atomic `UPDATE ... SET balance = balance - x WHERE balance >= x`, or lock the row with `SELECT ... FOR UPDATE`, or use optimistic locking with a version column and retry on conflict.' },
      { q: 'Why must the application retry under Serializable?', a: 'Serializable implementations (SSI in Postgres, or lock-based) detect dangerous interleavings and abort one transaction with a serialization failure (SQLSTATE 40001). Retrying the whole transaction is the expected way to handle it.' },
    ],
  },
  {
    id: 'db-mvcc',
    category: 'Databases (Senior)',
    difficulty: 3,
    question: 'What is MVCC and what are its operational implications?',
    tldr: 'Multi-Version Concurrency Control keeps several versions of each row so readers see a consistent snapshot without blocking writers; the price is cleanup of old versions (VACUUM in Postgres, undo purge in MySQL) and pain with long-running transactions.',
    answer: `**Idea**: instead of locking rows for reading, the database keeps **multiple versions**. Each transaction reads from a **snapshot**: the versions that were committed when its snapshot was taken.
- **Readers never block writers, and writers never block readers.**
- Writers still block other writers on the **same row** (row locks).

**PostgreSQL implementation**
- Each row version (tuple) has \`xmin\` (creating transaction) and \`xmax\` (deleting/updating transaction).
- \`UPDATE\` = insert a new version + mark the old one dead; \`DELETE\` = mark dead. Old versions stay in the table (heap).
- Visibility rules decide which version a snapshot sees.
- **VACUUM** (autovacuum) reclaims space from dead tuples that no running transaction can see anymore and updates the visibility map (which enables index-only scans).

**MySQL InnoDB implementation**: rows are updated in place; previous versions are reconstructed from the **undo log**, which a purge thread cleans up.

**Operational consequences**
- **Long-running transactions** (or an idle "in transaction" connection, or a forgotten replication slot) keep old snapshots alive, so VACUUM cannot remove dead tuples → **table and index bloat**, slower queries, more I/O.
- Update-heavy tables need tuned autovacuum (lower scale factors, more workers). HOT updates (no indexed column changed) reduce index churn.
- **Transaction ID wraparound** (Postgres): 32-bit XIDs must be "frozen" by VACUUM; if that falls behind, the database eventually stops accepting writes to protect data.

\`\`\`sql
-- find long-running / idle-in-transaction sessions
SELECT pid, state, xact_start, now() - xact_start AS age, left(query, 60)
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start;

-- tables with many dead tuples
SELECT relname, n_dead_tup, n_live_tup, last_autovacuum
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;
\`\`\`

**Good practice**: keep transactions short, set \`idle_in_transaction_session_timeout\`, never do network calls inside a DB transaction, and monitor bloat and vacuum lag.`,
    followUps: [
      { q: 'Why are long transactions dangerous in PostgreSQL?', a: 'They hold an old snapshot, so VACUUM cannot clean up any row version newer than that snapshot across the whole database. Dead tuples accumulate, causing bloat and slower queries, and in extreme cases they push towards transaction ID wraparound.' },
    ],
  },
  {
    id: 'db-locking',
    category: 'Databases (Senior)',
    difficulty: 2,
    question: 'Optimistic vs pessimistic locking: when do you use which?',
    tldr: 'Pessimistic locking takes the lock up front (SELECT ... FOR UPDATE) and suits high contention and short transactions; optimistic locking checks a version at write time and suits rare conflicts and long user think-time.',
    answer: `**Pessimistic locking**: assume conflicts will happen and lock first.
\`\`\`sql
BEGIN;
SELECT * FROM seats WHERE id = 17 FOR UPDATE;   -- others wait here
-- check availability in app code
UPDATE seats SET booked_by = 42 WHERE id = 17;
COMMIT;
\`\`\`
- Good for **high contention** on the same rows (inventory, seat booking, counters) and short transactions.
- Costs: waiting, lower throughput, **deadlock** risk, and you cannot hold DB locks across a user's think-time.
- Variants: \`FOR UPDATE NOWAIT\` (fail immediately), \`FOR UPDATE SKIP LOCKED\` (take the next free row: perfect for job queues), \`FOR SHARE\`.

**Optimistic locking**: assume conflicts are rare; detect them at write time.
\`\`\`sql
-- read: SELECT id, title, body, version FROM docs WHERE id = 5;  → version = 7
UPDATE docs SET title = $1, body = $2, version = version + 1
WHERE id = 5 AND version = 7;
-- 1 row updated  → success
-- 0 rows updated → someone else changed it: reload, merge or show a conflict to the user
\`\`\`
- No locks held between read and write, so it scales well and works across HTTP requests (send the version or an \`ETag\` to the client; \`If-Match\` on update → \`412 Precondition Failed\` on conflict).
- Great for user edits (forms, documents) and distributed systems.
- Under heavy contention it degrades into lots of retries.
- ORMs support it built-in: JPA \`@Version\`, Rails \`lock_version\`, EF Core concurrency tokens.

**Often the best answer: neither**
- An atomic conditional update: \`UPDATE stock SET qty = qty - 1 WHERE sku = 'X' AND qty > 0\` (check the affected row count).
- Unique constraints (\`ON CONFLICT DO NOTHING\`) to enforce "only once".`,
  },
  {
    id: 'db-deadlock',
    category: 'Databases (Senior)',
    difficulty: 2,
    question: 'Where do database deadlocks come from and how do you prevent them?',
    tldr: 'A deadlock is a cycle of transactions waiting for each other\'s locks; the DB detects it and aborts one, so prevent it by locking in a consistent order, keeping transactions short, indexing properly, and retrying the victim.',
    answer: `**How it happens**
\`\`\`text
T1: UPDATE accounts ... WHERE id = 1   -- locks row 1
T2: UPDATE accounts ... WHERE id = 2   -- locks row 2
T1: UPDATE accounts ... WHERE id = 2   -- waits for T2
T2: UPDATE accounts ... WHERE id = 1   -- waits for T1 → cycle
\`\`\`
The database's deadlock detector notices the cycle (Postgres checks after \`deadlock_timeout\`, 1 s by default) and **aborts one transaction** (SQLSTATE 40P01 in Postgres, error 1213 in MySQL).

**Prevention**
- **Consistent lock ordering**: always lock rows or tables in the same order, e.g. sort IDs ascending before updating multiple rows.
\`\`\`js
async function transfer(from, to, amount) {
  const [a, b] = [from, to].sort((x, y) => x - y);    // same order for everyone
  await db.tx(async t => {
    await t.query('SELECT 1 FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE', [a, b]);
    await t.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, from]);
    await t.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, to]);
  });
}
\`\`\`
- **Short transactions**: no user interaction or HTTP calls inside them; do the slow work before \`BEGIN\`.
- **Good indexes**: without an index, an \`UPDATE ... WHERE email = ?\` may scan and lock many more rows (or gap ranges in MySQL), increasing overlap.
- **Lower the lock footprint**: update fewer rows per transaction (batch large updates), and avoid needless \`SELECT ... FOR UPDATE\`.
- **Queue patterns**: \`FOR UPDATE SKIP LOCKED\` so workers never wait on each other.
- **Lock timeouts** (\`lock_timeout\`) so waits fail fast instead of piling up.

**Handling them**: deadlocks cannot be eliminated entirely under concurrency. The app must **catch the error and retry the whole transaction** (with a small backoff). Log and monitor them (\`log_lock_waits\`, \`SHOW ENGINE INNODB STATUS\`) to find the conflicting code paths.`,
  },
  {
    id: 'db-index-deep',
    category: 'Databases (Senior)',
    difficulty: 3,
    question: 'Indexes at senior level: composite, covering, partial, expression. When will an index NOT be used?',
    tldr: 'Composite indexes follow the leftmost-prefix rule (equality columns first, then range/sort), covering indexes enable index-only scans, partial and expression indexes target specific queries; functions on columns, leading wildcards, type mismatches and low selectivity defeat indexes.',
    answer: `**Composite indexes** (column order matters)
\`\`\`sql
CREATE INDEX idx_orders_cust_status_date ON orders (customer_id, status, created_at);
-- uses index:   WHERE customer_id = 1
--               WHERE customer_id = 1 AND status = 'paid'
--               WHERE customer_id = 1 AND status = 'paid' ORDER BY created_at DESC
-- cannot seek:  WHERE status = 'paid'            (leading column missing)
\`\`\`
Rule of thumb: **equality columns first, then the range or sort column**. A range in the middle stops later columns from being used for seeking.

**Covering index / index-only scan**
\`\`\`sql
CREATE INDEX idx_orders_cust_inc ON orders (customer_id) INCLUDE (total, status);
SELECT total, status FROM orders WHERE customer_id = 1;  -- no table (heap) access needed
\`\`\`

**Partial index**: index only the rows you query.
\`\`\`sql
CREATE INDEX idx_jobs_pending ON jobs (run_at) WHERE status = 'pending';
CREATE UNIQUE INDEX uniq_active_email ON users (email) WHERE deleted_at IS NULL;  -- soft deletes
\`\`\`

**Expression index**
\`\`\`sql
CREATE INDEX idx_users_lower_email ON users (lower(email));
SELECT * FROM users WHERE lower(email) = 'ann@example.com';
\`\`\`

**Index types (PostgreSQL)**: B-tree (default; equality, range, sort), Hash (equality only), **GIN** (JSONB, arrays, full-text search, trigram), GiST (geo, ranges, exclusion constraints), **BRIN** (huge append-only tables ordered by time: tiny and cheap).

**When an index is NOT used**
- A function or arithmetic on the column: \`WHERE date(created_at) = '2026-01-01'\`. Rewrite as a range:
\`\`\`sql
WHERE created_at >= '2026-01-01' AND created_at < '2026-01-02'
\`\`\`
- Leading wildcard: \`LIKE '%smith'\` (use trigram GIN or full-text search instead).
- Implicit type conversion: comparing a \`varchar\` column with a number, or mismatched collations.
- \`OR\` across different columns (sometimes solved with a BitmapOr or a \`UNION\`).
- **Low selectivity**: if the query returns a large fraction of the table, a sequential scan really is cheaper.
- **Stale statistics**: run \`ANALYZE\`; skewed data may need extended statistics.
- Small tables: a sequential scan is cheaper anyway.

**Costs to mention**: write amplification, storage, and duplicated or unused indexes. Find unused ones via \`pg_stat_user_indexes.idx_scan = 0\`. Build indexes in production with \`CREATE INDEX CONCURRENTLY\`.`,
    followUps: [
      { q: 'How do you read a plan from EXPLAIN ANALYZE? What do you look at?', a: 'Read it bottom-up and inside-out. Compare estimated vs actual rows (big gaps mean bad statistics), find the nodes with the highest actual time, look for Seq Scans on big tables, nested loops with many iterations, sorts or hashes spilling to disk, and with BUFFERS the number of pages read.' },
    ],
  },
  {
    id: 'db-explain',
    category: 'Databases (Senior)',
    difficulty: 2,
    question: 'A query is slow in production. How do you diagnose it?',
    tldr: 'Confirm and quantify with query statistics, reproduce with EXPLAIN (ANALYZE, BUFFERS) on realistic data, find the expensive plan node and the reason (missing index, bad estimates, N+1, locks), fix one thing, measure again and add monitoring.',
    answer: `1. **Find and quantify**: which queries cost the most **in total**? A 5 ms query called 10,000 times per minute matters more than one 2 s report.
\`\`\`sql
SELECT left(query, 80) AS query, calls, round(total_exec_time) AS total_ms,
       round(mean_exec_time, 1) AS mean_ms, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;
\`\`\`
2. **Get the real plan** on production-like data (statistics and sizes matter):
\`\`\`sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
\`\`\`
   Careful: \`ANALYZE\` executes the query, so wrap writes in \`BEGIN; ... ROLLBACK;\`.
3. **Read the plan**
- The most expensive nodes by **actual time × loops**.
- **Estimated vs actual rows**: a big mismatch means stale or insufficient statistics → \`ANALYZE\`, higher statistics target, extended statistics.
- **Seq Scan** on large tables with selective filters → missing or unusable index.
- **Nested Loop** with a huge outer side → missing join index or a bad estimate.
- **Sort / Hash** spilling to disk ("external merge") → \`work_mem\` or a better index.
- **Buffers read** (not hit) → lots of disk I/O.
4. **Check the context, not just the SQL**
- N+1 patterns from the ORM (many small identical queries).
- **Lock waits** (\`pg_locks\`, \`pg_stat_activity.wait_event\`).
- Connection pool exhaustion (the query is fast, waiting for a connection is slow).
- Table or index bloat, autovacuum lag.
- Parameter-sensitive plans (generic plan bad for skewed values).
5. **Fix**: add the right (composite or covering) index, rewrite the query (sargable predicates, keyset pagination instead of \`OFFSET\`, avoid \`SELECT *\`, pre-aggregate), batch, cache or denormalise.
6. **Verify and prevent**: measure before and after, add alerts on p95/p99 latency, enable \`auto_explain\` for slow queries, and add query-count assertions in tests.

\`\`\`sql
-- keyset pagination instead of OFFSET (constant cost regardless of page depth)
SELECT id, created_at, title FROM posts
WHERE (created_at, id) < ($last_created_at, $last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
\`\`\``,
  },
  {
    id: 'db-n-plus-one',
    category: 'Databases (Senior)',
    difficulty: 1,
    question: 'What is the N+1 query problem and how do you fix it?',
    tldr: 'Loading a list with one query and then running one extra query per item (N+1 round trips), usually caused by ORM lazy loading; fix it with eager loading, joins, IN-batching or DataLoader.',
    answer: `**Example**
\`\`\`js
const posts = await Post.findAll({ limit: 50 });          // 1 query
for (const p of posts) {
  p.author = await User.findByPk(p.authorId);             // 50 more queries
}
\`\`\`
Each query may be fast, but 51 round trips (each with network latency, parsing and planning) add up, and it gets worse as N grows. It is easy to miss in development with 5 rows.

**Fixes**
- **Eager loading** in the ORM: \`include\` (Sequelize/Prisma), \`JOIN FETCH\` / \`@EntityGraph\` (JPA), \`select_related\` / \`prefetch_related\` (Django), \`includes\` (Rails).
- **One JOIN** when it is a to-one relation.
- **Batch with IN** for to-many relations (avoids row multiplication):
\`\`\`js
const posts = await db.query('SELECT * FROM posts ORDER BY id DESC LIMIT 50');
const ids = [...new Set(posts.map(p => p.author_id))];
const authors = await db.query('SELECT * FROM users WHERE id = ANY($1)', [ids]);
const byId = new Map(authors.map(a => [a.id, a]));
posts.forEach(p => { p.author = byId.get(p.author_id); });   // 2 queries total
\`\`\`
- **GraphQL**: resolvers naturally cause N+1. Use **DataLoader**, which collects all keys requested in one tick and issues a single batched query (plus per-request caching).

**Detection**
- Log SQL in development; tools like Bullet (Rails), the Hibernate statistics, the Django debug toolbar.
- APM traces showing many identical spans.
- Tests asserting the number of queries per request.`,
  },
  {
    id: 'db-sql-nosql',
    category: 'Databases (Senior)',
    difficulty: 2,
    question: 'SQL or NoSQL? How do you choose a database for a problem?',
    tldr: 'Start from data shape, access patterns, consistency and scale requirements; a relational database is the sensible default, and specialised stores are added for specific needs like massive key-value scale, search, graphs or time series.',
    answer: `**Questions to ask first**
- What are the **access patterns**? Ad-hoc queries and reporting, or a few known lookups by key?
- How **relational** is the data? Do you need joins and constraints?
- **Consistency and transactions** needed? Multi-row or multi-entity invariants?
- **Scale**: data size, write throughput, geographic distribution.
- **Team skills and operational cost**, managed offerings.

**Options**
- **Relational (PostgreSQL, MySQL)**: ACID transactions, joins, constraints, flexible ad-hoc queries, mature tooling. Postgres also does JSONB, full-text search, geo (PostGIS) and queues. **The right default for most business systems.**
- **Document (MongoDB, Firestore)**: hierarchical, self-contained aggregates read and written as a whole; flexible schema. Weak at cross-document joins.
- **Key-value (Redis, DynamoDB)**: simple get/put by key at massive scale and low latency. DynamoDB requires designing tables around access patterns (single-table design, GSIs).
- **Wide-column (Cassandra, ScyllaDB)**: huge write throughput, multi-datacenter, queries known in advance (one table per query); eventual consistency (tunable).
- **Graph (Neo4j)**: deep relationship traversal (recommendations, fraud rings, permissions).
- **Search (Elasticsearch, OpenSearch)**: full-text, relevance, facets. Usually a secondary index fed from the primary DB, not the source of truth.
- **Time series (TimescaleDB, InfluxDB)** for metrics and IoT; **OLAP / columnar (ClickHouse, BigQuery, Snowflake)** for analytics.

**NoSQL modelling note**: you design for queries, denormalise and duplicate data. Changing access patterns later is expensive, which is the opposite of relational modelling.

\`\`\`text
DynamoDB single-table example (access pattern: "orders of a customer, newest first")
PK = CUSTOMER#123   SK = ORDER#2026-11-10#987   → Query(PK, SK begins_with "ORDER#", desc)
\`\`\`

**Polyglot persistence** is fine, but every extra datastore adds operational load, consistency issues (sync via CDC/events) and learning cost. Justify each one.`,
  },
  {
    id: 'db-zero-downtime-migration',
    category: 'Databases (Senior)',
    difficulty: 3,
    question: 'How do you run a schema migration with zero downtime (e.g. renaming a column)?',
    tldr: 'Use expand → migrate → contract: make only backward-compatible changes per deploy (add new, dual-write, backfill in batches, switch reads, stop old writes, drop old), and avoid long table-locking DDL.',
    answer: `**Why it is hard**: during a rolling deploy, old and new app versions run **at the same time** against the same schema, and rollbacks must still work. A plain \`ALTER TABLE ... RENAME COLUMN\` breaks the old version instantly.

**Expand → migrate → contract (parallel change)**: renaming \`users.name\` to \`users.full_name\`:
1. **Expand**: add the new column (nullable, no default rewrite).
\`\`\`sql
ALTER TABLE users ADD COLUMN full_name text;
\`\`\`
2. **Deploy A**: the app **writes both** columns and still reads \`name\`. (Alternatively a DB trigger keeps them in sync.)
3. **Backfill** in small batches to avoid long locks and replication lag:
\`\`\`sql
UPDATE users SET full_name = name
WHERE id IN (SELECT id FROM users WHERE full_name IS NULL LIMIT 5000);
-- repeat until 0 rows, with a short pause between batches
\`\`\`
4. **Deploy B**: the app **reads \`full_name\`**, still writing both (so a rollback to A remains safe).
5. **Deploy C**: stop writing \`name\`.
6. **Contract**: drop the old column once nothing references it.
\`\`\`sql
ALTER TABLE users DROP COLUMN name;
\`\`\`

**Dangerous operations (PostgreSQL examples)**
- \`CREATE INDEX\` locks writes → use \`CREATE INDEX CONCURRENTLY\` (outside a transaction).
- Adding \`NOT NULL\` scans the table under a strong lock → add a \`CHECK (col IS NOT NULL) NOT VALID\` constraint, \`VALIDATE CONSTRAINT\` later, then set NOT NULL.
- Adding a foreign key → \`NOT VALID\` first, then \`VALIDATE\`.
- Changing a column type usually rewrites the table → use a new column + backfill.
- Even quick DDL needs an \`ACCESS EXCLUSIVE\` lock and can queue **behind a long query**, blocking everything behind it, so always set a timeout:
\`\`\`sql
SET lock_timeout = '3s';   -- fail fast and retry instead of freezing the table
\`\`\`

**Process**: migrations are versioned and automated (Flyway, Liquibase, Prisma Migrate, Alembic), run separately from app startup, tested on a production-sized copy, and every app release stays compatible with the schema version before and after. Tools like gh-ost / pt-online-schema-change (MySQL) or pgroll help with big tables.`,
  },

  // =====================================================================
  // ARCHITECTURE
  // =====================================================================
  {
    id: 'arch-monolith-micro',
    category: 'Architecture',
    difficulty: 2,
    question: 'Monolith or microservices? When is it worth migrating?',
    tldr: 'Microservices mainly solve organisational scaling (independent teams and deployments) at a high cost in distributed complexity; the sensible default is a well-modularised monolith, split incrementally (Strangler Fig) when there is a clear need.',
    answer: `**Microservices give you**
- Independent deployment and release cadence per team.
- Independent scaling of hot components.
- Fault isolation (if done well) and technology freedom.
- Clear ownership boundaries for many teams.

**They cost you**
- **Network**: latency, partial failures, retries, timeouts.
- **Data**: no cross-service transactions or joins → sagas, eventual consistency, data duplication.
- **Operations**: service discovery, CI/CD per service, observability (distributed tracing), on-call per service.
- **Testing**: integration and contract testing, local development environments.
- **Versioning** of APIs and events.

**Senior answer: "it depends, but default to a modular monolith"**
- A **modular monolith** has strict internal module boundaries (separate packages, no reaching into other modules' tables, explicit interfaces), deployed as one unit. You get most of the design benefits without the distributed cost.
- Microservices are primarily an answer to **Conway's law and team scaling**, not a performance technique.

**Signals that splitting is worth it**
- Many teams constantly blocking each other on the release train.
- Parts with very different scaling, availability or security requirements (e.g. a public API vs a batch reporting job).
- Clear, stable domain boundaries (bounded contexts) with little chatty communication.

**How to migrate: Strangler Fig**
1. Put a facade or proxy (API gateway, routing) in front of the monolith.
2. Extract one capability at a time behind it, starting with a well-bounded, valuable piece.
3. Give it its own data (sync with CDC or events during the transition).
4. Route traffic gradually and retire the old code.
Never do a big-bang rewrite.

**Anti-pattern: the distributed monolith**: services that must be deployed together, share a database or call each other synchronously in long chains. You pay all the costs and get none of the benefits.`,
    followUps: [
      { q: 'How do you decide service boundaries?', a: 'Around business capabilities / DDD bounded contexts, aiming for high cohesion inside and loose coupling between services. Look for parts that change together, have their own data and their own team. If two services need to talk constantly or share transactions, they probably belong together.' },
      { q: 'Can services share a database?', a: 'Sharing tables couples them at the schema level: one team\'s migration can break another, and ownership becomes unclear. Prefer database-per-service (separate schemas are a pragmatic start), and share data through APIs or events.' },
    ],
  },
  {
    id: 'arch-ddd',
    category: 'Architecture',
    difficulty: 3,
    question: 'Explain the key concepts of Domain-Driven Design: bounded context, aggregate, ubiquitous language.',
    tldr: 'DDD aligns code with the business: a ubiquitous language shared with domain experts, bounded contexts where each model is consistent, and aggregates as transactional consistency boundaries that communicate via domain events.',
    answer: `**Strategic DDD (the most valuable part)**
- **Ubiquitous language**: the same terms in conversations, documents and code. If the business says "policy holder", the class is not \`CustomerData\`.
- **Bounded context**: an explicit boundary within which a model and its language are consistent. "Customer" in Sales (leads, discounts) and in Support (tickets, SLAs) are **different models**, and that is fine. Bounded contexts are natural candidates for modules or services and team ownership.
- **Context map**: how contexts relate: customer/supplier, conformist, **anti-corruption layer** (translate a messy external or legacy model into your own), shared kernel, published language.
- **Subdomains**: core (your competitive advantage, so invest heavily), supporting, and generic (buy it or use SaaS).

**Tactical DDD (building blocks)**
- **Entity**: has an identity that persists over time (Order #123).
- **Value object**: defined by its attributes, immutable, compared by value (\`Money\`, \`Address\`, \`DateRange\`). It puts validation and behaviour where they belong.
- **Aggregate**: a cluster of entities and value objects treated as one unit for changes, with an **aggregate root** as the only entry point. It enforces invariants and is the **transaction boundary**: one transaction modifies one aggregate.
- **Domain events**: something meaningful happened (\`OrderPlaced\`). Other aggregates and contexts react to it, typically with eventual consistency.
- **Repositories** load and save whole aggregates; **domain services** hold logic that does not fit one entity.

\`\`\`ts
class Order {                                // aggregate root
  private lines: OrderLine[] = [];
  private status: 'DRAFT' | 'PLACED' = 'DRAFT';
  readonly events: DomainEvent[] = [];

  addLine(productId: string, qty: number, price: Money) {
    if (this.status !== 'DRAFT') throw new Error('Cannot modify a placed order');
    if (qty <= 0) throw new Error('Quantity must be positive');
    this.lines.push(new OrderLine(productId, qty, price));
  }

  place() {
    if (this.lines.length === 0) throw new Error('Empty order');
    this.status = 'PLACED';
    this.events.push({ type: 'OrderPlaced', orderId: this.id, total: this.total() });
  }

  total(): Money { return this.lines.reduce((sum, l) => sum.add(l.subtotal()), Money.zero('EUR')); }
}
\`\`\`

**Aggregate design rules**: keep aggregates **small**, reference other aggregates **by ID**, and update other aggregates via events. A huge aggregate becomes a contention and performance problem.

**When not to use DDD**: simple CRUD apps with little business logic. The heavy tactical patterns there are overkill.`,
  },
  {
    id: 'arch-hexagonal',
    category: 'Architecture',
    difficulty: 2,
    question: 'What is hexagonal architecture (ports & adapters) / Clean Architecture?',
    tldr: 'The domain and use cases sit in the centre with no dependencies on frameworks or infrastructure; they define ports (interfaces), and adapters (DB, HTTP, messaging) implement them, so dependencies always point inwards.',
    answer: `**Core idea**: business logic must not depend on technical details. Dependencies point **inwards** (Dependency Inversion).

- **Domain / application core**: entities, value objects, use cases. Plain code with no framework annotations, SQL or HTTP.
- **Ports**: interfaces the core needs or offers.
  - **Driving (inbound) ports**: use cases the outside world calls (\`PlaceOrder\`).
  - **Driven (outbound) ports**: what the core needs (\`OrderRepository\`, \`PaymentGateway\`, \`Clock\`).
- **Adapters**: implementations at the edges: REST controller, GraphQL resolver, Kafka consumer (driving); Postgres repository, Stripe client, SMTP sender (driven).

\`\`\`ts
// port (owned by the core)
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// use case (core): depends only on ports
export class PlaceOrder {
  constructor(private orders: OrderRepository, private payments: PaymentGateway) {}
  async execute(orderId: string) {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFound(orderId);
    order.place();
    await this.payments.charge(order.customerId, order.total());
    await this.orders.save(order);
  }
}

// adapter (infrastructure)
export class PgOrderRepository implements OrderRepository { /* SQL here */ }

// test: no database needed
const useCase = new PlaceOrder(new InMemoryOrderRepository(), new FakePaymentGateway());
\`\`\`

**Benefits**
- The domain is testable fast and in isolation (in-memory fakes).
- Infrastructure is replaceable (switch the DB, add a CLI or a queue consumer as another driving adapter).
- Boundaries are explicit and the business logic is easy to find.

**Costs and judgement**
- More files, interfaces and mapping between layers (domain ↔ persistence ↔ DTO).
- For a simple CRUD service it is overengineering; a straightforward layered or "vertical slice" design is enough.
- Seniors apply it where domain logic is rich and long-lived, and keep it light elsewhere.

Related: **Onion** and **Clean Architecture** (Uncle Bob) are variations of the same dependency rule.`,
  },
  {
    id: 'arch-cqrs-es',
    category: 'Architecture',
    difficulty: 3,
    question: 'CQRS and Event Sourcing: what are they and when do they make sense?',
    tldr: 'CQRS separates the write model (commands, invariants) from read models optimised for queries; Event Sourcing stores state as an append-only sequence of events. Both are powerful in specific contexts and costly when applied everywhere.',
    answer: `**CQRS (Command Query Responsibility Segregation)**
- **Commands** change state through a write model focused on invariants and validation.
- **Queries** read from **read models / projections** shaped for specific screens or APIs (denormalised, possibly in a different store such as Elasticsearch or Redis).
- It can be as light as separate code paths over the same DB, or as heavy as separate databases synced via events (then read models are **eventually consistent**).
- Worth it when reads and writes have very different shapes or loads, or there are many different read views.

**Event Sourcing**
- Instead of storing current state, store every change as an **immutable event**: \`AccountOpened\`, \`MoneyDeposited\`, \`MoneyWithdrawn\`.
- Current state = fold (replay) of the events; **snapshots** speed up long streams.
- Writes append events with an **expected version** (optimistic concurrency).

\`\`\`ts
type Event =
  | { type: 'Deposited'; amount: number }
  | { type: 'Withdrawn'; amount: number };

function balance(events: Event[]): number {
  return events.reduce((b, e) => (e.type === 'Deposited' ? b + e.amount : b - e.amount), 0);
}

async function withdraw(accountId: string, amount: number) {
  const { events, version } = await store.load(accountId);
  if (balance(events) < amount) throw new Error('Insufficient funds');
  await store.append(accountId, [{ type: 'Withdrawn', amount }], { expectedVersion: version });
  // append fails if someone else appended in between → reload and retry
}
\`\`\`

**Benefits of Event Sourcing**
- A complete **audit log** for free; you can answer "how did we get here?".
- Temporal queries (state at any point in time) and debugging by replay.
- New read models can be built later by replaying history.
- Natural fit with event-driven integration.

**Costs**
- **Event schema evolution**: events are stored forever, so you need versioning and upcasting.
- Eventual consistency of read models (UX must handle "just saved but not visible yet").
- Querying current state requires projections.
- GDPR "right to be forgotten" vs immutable events (crypto-shredding: encrypt personal data per user and delete the key).
- Higher learning curve and operational complexity.

**Senior judgement**: use them **per bounded context** where auditability and complex state transitions matter (finance, ledgers, logistics, booking), not as a system-wide default.`,
  },
  {
    id: 'arch-api-styles',
    category: 'Architecture',
    difficulty: 2,
    question: 'REST vs gRPC vs GraphQL: when would you use each?',
    tldr: 'REST is the universal default for public and resource-oriented APIs, gRPC is efficient and strongly typed for internal service-to-service calls, and GraphQL lets diverse clients fetch exactly what they need from one aggregated schema.',
    answer: `**REST (HTTP + JSON)**
- Universal: every language, tool and proxy understands it; easy debugging with curl.
- Leverages HTTP: caching (ETag, Cache-Control, CDNs), status codes, content negotiation.
- Downsides: over-fetching or under-fetching (several round trips for one screen), loosely typed unless you use OpenAPI.
- Best for **public APIs**, CRUD-style resources and web integrations.

**gRPC (HTTP/2 + Protocol Buffers)**
- Compact binary encoding, multiplexed connections, low latency.
- **Strict contracts** in \`.proto\` files with generated clients and servers in many languages.
- Streaming: server, client and bidirectional.
- Built-in deadlines, cancellation and metadata.
- Downsides: browsers need gRPC-Web or a proxy; payloads are not human-readable; HTTP caching does not apply.
- Best for **internal service-to-service** communication and high-throughput or streaming workloads.

\`\`\`protobuf
service OrderService {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrders (WatchRequest) returns (stream OrderEvent);
}
message GetOrderRequest { string id = 1; }
\`\`\`

**GraphQL**
- One endpoint, a typed schema, and clients request **exactly the fields** they need, aggregating several backends in one request.
- Great for **multiple frontends** (web, iOS, Android) with different needs, and fast UI iteration. Often used as a BFF / gateway layer (federation).
- Costs: HTTP caching is harder (persisted queries help), **N+1 in resolvers** (DataLoader), protection against expensive queries (depth and complexity limits, timeouts), **field-level authorisation**, and error handling inside 200 responses.

\`\`\`graphql
query {
  order(id: "42") {
    status
    items { name quantity }
    customer { name }
  }
}
\`\`\`

**Plus asynchronous messaging** (events over Kafka/RabbitMQ) when the caller does not need an immediate answer, which often gives looser coupling than any synchronous style.

A typical mature setup: REST or GraphQL at the edge, gRPC or events internally.`,
  },
  {
    id: 'arch-api-versioning',
    category: 'Architecture',
    difficulty: 2,
    question: 'How do you version and evolve an API without breaking clients?',
    tldr: 'Prefer additive, backward-compatible changes with tolerant readers; when a breaking change is unavoidable, introduce a new version, run both in parallel, communicate deprecation with dates and headers, and track who still uses the old one.',
    answer: `**Backward-compatible (safe) changes**
- Adding new endpoints, new optional request fields, or new response fields.
- Adding new enum values is risky: old clients may not handle them, so document that clients must tolerate unknown values.

**Breaking changes**
- Removing or renaming fields or endpoints, changing types or formats, making optional fields required, changing semantics or default behaviour, tightening validation, changing error codes.

**Principles**
- **Tolerant reader**: clients ignore unknown fields and do not depend on field order.
- **Robustness**: be strict in what you send, tolerant in what you accept (within reason).
- Model for evolution from day one: objects instead of bare arrays at the top level (so you can add metadata), string IDs, enums treated as open.

**Versioning strategies**
- **URL path** (\`/v1/orders\`, \`/v2/orders\`): explicit, simple for routing, caching and docs. Most common.
- **Header / media type** (\`Accept: application/vnd.acme.v2+json\`): cleaner URLs, less visible.
- **Date-based versions per client** (Stripe: \`Stripe-Version: 2024-06-20\`): the server keeps a chain of transformations from the latest internal model back to older versions. Excellent developer experience, more server work.
- **GraphQL**: usually no versions; evolve the schema and \`@deprecated\` fields.

**Deprecation process**
1. Announce with a timeline (changelog, email, docs).
2. Add response headers (\`Deprecation\`, \`Sunset: Wed, 31 Mar 2027 00:00:00 GMT\`, and a \`Link\` to the migration guide).
3. **Measure usage per client** (logs and metrics by API key) and contact heavy users.
4. Brownouts (planned short outages of the old version) to flush out forgotten integrations.
5. Remove.

**Internal APIs and events**: **consumer-driven contract tests** (Pact) catch breaking changes in CI; for events, use a **schema registry** with compatibility rules (Avro/Protobuf backward/forward compatibility).`,
  },
  {
    id: 'arch-coupling',
    category: 'Architecture',
    difficulty: 2,
    question: 'What are coupling and cohesion, and how do you influence them?',
    tldr: 'Cohesion is how strongly the things inside a module belong together (want high); coupling is how much modules depend on each other (want low). Organise around business capabilities, hide internals behind narrow interfaces and watch for hidden forms of coupling.',
    answer: `**Cohesion**: the elements of a module serve one purpose and change for the same reasons. High cohesion means a change is localised.

**Coupling**: the degree to which one module depends on others' details. Low coupling means you can change, test and deploy modules independently.

**Practical techniques**
- **Organise by feature or domain, not by technical layer.** \`/orders\` (controller, service, repo, tests together) is more cohesive than \`/controllers\`, \`/services\`, \`/repositories\` spread across the codebase.
- **Narrow, explicit interfaces**: expose a small public API per module and keep the rest private (package-private, \`internal\`, barrel files exporting only the public surface).
- **Dependency inversion**: depend on abstractions owned by the consumer.
- **Events** for cross-module side effects ("when an order is placed, send an email") instead of direct calls, where eventual consistency is acceptable.
- **Data ownership**: no module reads another module's tables directly.
- **Enforce boundaries automatically**: ArchUnit (Java), dependency-cruiser or eslint-plugin-boundaries (JS/TS), Nx module boundaries.

\`\`\`js
// .dependency-cruiser.js: forbid reaching into another module's internals
module.exports = {
  forbidden: [{
    name: 'no-cross-module-internals',
    from: { path: '^src/modules/([^/]+)/' },
    to:   { path: '^src/modules/([^/]+)/internal/', pathNot: '^src/modules/$1/' },
    severity: 'error',
  }],
};
\`\`\`

**Forms of coupling to recognise**
- **Temporal coupling**: A must be up for B to work (synchronous call chains).
- **Data/schema coupling**: a shared database or a shared DTO library with business logic.
- **Deployment coupling**: services that must release together.
- **Semantic coupling**: both sides must interpret a field the same way ("status = 3").
- **Platform coupling**: everything tied to one framework version.

Some coupling is necessary. The goal is to make it **explicit, intentional and in the right places**.`,
  },
  {
    id: 'arch-decisions',
    category: 'Architecture',
    difficulty: 2,
    question: 'How do you make and document architectural decisions?',
    tldr: 'Match the rigour to the reversibility of the decision, evaluate options against explicit criteria with the people affected, validate risky assumptions with spikes, and record the outcome in short Architecture Decision Records next to the code.',
    answer: `**Classify the decision**
- **Two-way doors** (easy to reverse: a library inside one module, an internal API shape) → decide quickly, delegate to the team.
- **One-way doors** (expensive to reverse: primary database, language or platform, service boundaries, public API contracts, data model of core entities) → slow down: write an RFC or design doc, prototype, review.

**Process**
1. **Context and drivers**: the problem, constraints, and quality attributes that matter (latency, cost, time to market, team skills, compliance).
2. **Options**: at least 2–3 real alternatives, including "do nothing" or "the simplest thing".
3. **Evaluate** against the drivers: a trade-off table, back-of-the-envelope numbers, a **spike or proof of concept** for the riskiest assumption.
4. **Involve** the people who will build, operate and be affected by it (design review, RFC comments). Avoid the ivory-tower architect.
5. **Decide**, with a named owner, and record it.

**ADR (Architecture Decision Record)**: a short markdown file in the repo (\`docs/adr/0007-use-postgres-for-orders.md\`):
\`\`\`markdown
# 7. Use PostgreSQL as the primary store for the Orders service
Status: Accepted (2026-03-02). Supersedes ADR-3.

## Context
Orders need multi-row transactions and ad-hoc reporting; ~300 writes/s expected...

## Options considered
1. PostgreSQL  2. DynamoDB  3. MongoDB

## Decision
PostgreSQL 16 on managed RDS, with read replicas for reporting.

## Consequences
+ ACID, team experience, SQL reporting
- Vertical scaling limits; revisit if writes exceed ~5k/s (see metrics dashboard)
\`\`\`
ADRs are **immutable**: a changed decision gets a new ADR that supersedes the old one. Months later you can still find out why something was done.

**Communicating architecture**: the **C4 model** (Context, Containers, Components, Code), diagrams as code (Structurizr, Mermaid, PlantUML) kept in the repo, and fitness functions (automated checks for important architectural properties).`,
  },
  {
    id: 'arch-tech-debt',
    category: 'Architecture',
    difficulty: 2,
    question: 'How do you manage technical debt?',
    tldr: 'Treat debt as a deliberate business tool: make it visible, prioritise it by impact (hotspots where code changes often and hurts most), explain it in business terms and pay it down continuously instead of through big rewrites.',
    answer: `**Not all debt is equal** (Martin Fowler's quadrant): deliberate and prudent ("ship now, refactor next sprint", recorded) is fine; reckless or inadvertent debt is what hurts. Debt also accrues naturally as the domain understanding evolves.

**1. Make it visible**
- Track it as tickets or a debt register with impact and cost, not vague TODO comments.
- Use metrics that hint at debt: lead time for changes in an area, bug density, change failure rate, onboarding time, flaky tests, build time.

**2. Prioritise by impact**
- **Hotspot analysis**: code that is both **complex** and **changed often** is where debt costs the most. Debt in stable code nobody touches can wait.
\`\`\`bash
# most frequently changed files in the last year: combine with complexity metrics
git log --since="1 year ago" --name-only --format="" | sort | uniq -c | sort -rn | head -20
\`\`\`
- Consider risk (security, outdated dependencies, end-of-life runtimes) as well as productivity.

**3. Speak the business language**
- Not "the code is ugly" but "adding a new payment method takes 3 weeks instead of 3 days, and this area caused 4 incidents last quarter. Two sprints of refactoring cut that in half."
- Tie it to goals the business already cares about: delivery speed, reliability, cost, security and compliance.

**4. Pay it down continuously**
- Boy Scout rule: leave code a bit better whenever you touch it.
- A steady capacity allocation (e.g. 15–20% per sprint) beats occasional "refactoring sprints".
- Refactor **as part of** feature work in that area (preparatory refactoring: "make the change easy, then make the easy change").
- Large structural changes go incrementally (Strangler Fig, branch by abstraction, feature flags), not big-bang rewrites, which usually take 2–3× longer and lose undocumented business rules.

**5. Prevent new debt**: definition of done (tests, docs), code review, ADRs for shortcuts with a payback plan, automated quality gates and dependency updates (Renovate/Dependabot).`,
  },
]);
