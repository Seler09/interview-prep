/*
  .NET TRACK: EF CORE & SQL, ARCHITECTURE & PATTERNS
  Format: see the comment at the top of questions.js
*/
addQuestions('dotnet', [
  // =====================================================================
  // EF CORE & SQL
  // =====================================================================
  {
    id: 'ef-n-plus-one',
    category: 'EF Core & SQL',
    difficulty: 2,
    question: 'What is the N+1 problem in EF Core? How do you detect and fix it?',
    tldr: 'N+1 = one query for the list plus one extra query per row (usually via lazy loading or a query inside a loop); you spot it in SQL logs / App Insights dependency counts and fix it with a projection (Select), Include, or batching the lookup into one query.',
    answer: `**What it looks like**
\`\`\`csharp
var orders = await db.Orders.ToListAsync();          // 1 query
foreach (var o in orders)
    Console.WriteLine(o.Customer.Name);              // +1 query per order (lazy loading)
\`\`\`
100 orders = 101 round-trips. Each is fast on its own, so it hides in development and explodes in production with real data and network latency.

**Typical causes**
- **Lazy loading** proxies (\`UseLazyLoadingProxies\`) touching navigation properties in a loop or during serialisation.
- An explicit query **inside a loop** (\`foreach (id in ids) await db.X.FindAsync(id)\`).
- Mapping libraries walking navigations after the query has run.

**How to detect it**
- Log SQL in development: \`optionsBuilder.LogTo(Console.WriteLine, LogLevel.Information)\` and watch for the same statement repeated.
- **Application Insights / OpenTelemetry**: one request with dozens of identical SQL dependencies.
- MiniProfiler, or a test that asserts the number of executed commands (interceptor).

**How to fix it**
\`\`\`csharp
// 1. Projection: one query, only the columns you need (usually the best for reads)
var list = await db.Orders
    .Select(o => new OrderDto(o.Id, o.Total, o.Customer.Name))
    .ToListAsync(ct);

// 2. Eager loading when you need the entities (e.g. to modify them)
var orders = await db.Orders.Include(o => o.Customer).ToListAsync(ct);

// 3. Replace the loop with one set-based query
var customers = await db.Customers.Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, ct);
\`\`\`

**Senior point**: I keep lazy loading off by default, so a missing \`Include\` shows up as a null / empty collection in a test, not as 500 hidden queries in production.`,
    followUps: [
      { q: 'Can Include cause its own performance problem?', a: 'Yes. Several collection Includes in one query produce a cartesian product (rows multiply). Use `AsSplitQuery()` or a projection in that case.' },
      { q: 'How would you guard against N+1 regressions?', a: 'An integration test with a `DbCommandInterceptor` that counts commands for a key endpoint, plus App Insights alerts on dependency count per request.' },
    ],
  },
  {
    id: 'ef-asnotracking',
    category: 'EF Core & SQL',
    difficulty: 2,
    question: 'How does change tracking work, and when do you use AsNoTracking?',
    tldr: 'The DbContext keeps a snapshot of every tracked entity and diffs it on SaveChanges; for read-only queries that cost is wasted, so use AsNoTracking (or a projection), and AsNoTrackingWithIdentityResolution when the same entity appears many times in the result.',
    answer: `**Change tracking**
- Entities returned by a query are **tracked** by default: the context stores an original-values snapshot and an identity map (one instance per primary key).
- \`SaveChanges\` runs \`DetectChanges\`, compares current values to the snapshot and generates \`INSERT/UPDATE/DELETE\`.
- Cost: memory for snapshots and CPU for the diff. For thousands of rows it is noticeable.

**AsNoTracking**
\`\`\`csharp
var items = await db.Products.AsNoTracking()
    .Where(p => p.IsActive).ToListAsync(ct);
\`\`\`
- No snapshot, no identity map, faster and lighter. Use it for **read-only** queries: GET endpoints, reports, query handlers in CQRS.
- You can set it globally: \`options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)\` and opt in with \`AsTracking()\` on the write side.

**AsNoTrackingWithIdentityResolution**
- Not tracked, but still de-duplicates: if 100 orders share a customer, you get **one** Customer instance instead of 100 copies. Useful with \`Include\` on large graphs.

**Projection (Select) needs no tracking at all**: a query that returns DTOs is never tracked, which is another reason to project on the read side.

**When you MUST track**: when you load an entity in order to change it and call \`SaveChanges\` (or attach it explicitly with \`Update\`/\`Attach\`).`,
    followUps: [
      { q: 'What does a long-lived DbContext do to performance?', a: 'The change tracker keeps growing, DetectChanges gets slower and memory grows. That is why DbContext is Scoped (one per request) and should be short-lived in background jobs (create a scope per unit of work).' },
      { q: 'What happens if you call Update() on a detached entity?', a: 'EF marks the entity and all reachable entities as Modified and updates every column, even unchanged ones. Prefer loading and modifying, or `ExecuteUpdate` for set-based updates.' },
    ],
  },
  {
    id: 'ef-include-vs-projection',
    category: 'EF Core & SQL',
    difficulty: 2,
    question: 'Include or a projection with Select: which do you choose and why? What are split queries?',
    tldr: 'For reads I project to a DTO with Select (only needed columns, no tracking, no over-fetching); Include is for loading entities I am going to modify. Multiple collection Includes cause a cartesian explosion, which AsSplitQuery solves at the cost of several round-trips.',
    answer: `**Include (eager loading)**
- Loads whole entities plus related ones. Every column of every table.
- Natural on the **write side**: load the aggregate, change it, \`SaveChanges\`.

**Projection with Select**
\`\`\`csharp
var dto = await db.Orders
    .Where(o => o.Id == id)
    .Select(o => new OrderDetailsDto
    {
        Id = o.Id,
        CustomerName = o.Customer.Name,
        Lines = o.Lines.Select(l => new LineDto(l.Product.Name, l.Quantity)).ToList()
    })
    .SingleOrDefaultAsync(ct);
\`\`\`
- Only the columns you need → less I/O, better index usage (covering indexes).
- Not tracked, no risk of exposing the entity in the API (no over-posting / data leaks).
- My default for **queries / GET endpoints**.

**Cartesian explosion**
\`Include(o => o.Lines).Include(o => o.Payments)\` in a single SQL query JOINs both collections: 10 lines × 10 payments = 100 rows per order, with the order columns duplicated each time.

**Split queries**
\`\`\`csharp
db.Orders.Include(o => o.Lines).Include(o => o.Payments).AsSplitQuery();
\`\`\`
- One SQL query per collection, joined in memory. No row multiplication.
- Trade-offs: more round-trips, and without a transaction the separate queries can see **inconsistent data** if someone writes in between.
- Can be set globally with \`UseQuerySplittingBehavior\`.

**Lazy / eager / explicit loading**
- **Eager**: \`Include\` up front.
- **Explicit**: \`await db.Entry(order).Collection(o => o.Lines).LoadAsync()\` when needed.
- **Lazy**: proxies load on property access — convenient but the main source of N+1, so I avoid it in web apps.`,
    followUps: [
      { q: 'Can you use AutoMapper with projections?', a: 'Yes, `ProjectTo<TDto>()` translates the mapping into a Select expression, so it stays a SQL projection. Mapping after `ToList()` loads full entities first.' },
    ],
  },
  {
    id: 'ef-see-sql',
    category: 'EF Core & SQL',
    difficulty: 1,
    question: 'How do you see what SQL EF Core generates?',
    tldr: 'ToQueryString() on the query, LogTo / ILogger with the Microsoft.EntityFrameworkCore.Database.Command category, and in production the SQL dependencies in Application Insights or SQL Server tools (Query Store, Extended Events).',
    answer: `**During development**
\`\`\`csharp
var query = db.Orders.Where(o => o.Total > 100).Select(o => new { o.Id, o.Total });
Console.WriteLine(query.ToQueryString());           // the SQL, without executing it

options.UseSqlServer(cs)
       .LogTo(Console.WriteLine, LogLevel.Information)
       .EnableSensitiveDataLogging()                  // parameter values: dev only!
       .EnableDetailedErrors();
\`\`\`
- Or configure logging: \`"Microsoft.EntityFrameworkCore.Database.Command": "Information"\` in appsettings.Development.json.
- Interceptors (\`DbCommandInterceptor\`) to log, measure or tag commands.
- \`TagWith("GetOrdersForDashboard")\` adds a comment to the SQL, so you can find the query in the database monitoring tools.

**In production**
- **Application Insights**: each SQL call is a dependency with duration (and the command text if enabled).
- **SQL Server**: Query Store (top resource-consuming queries, plan regressions), execution plans, Extended Events.

**Why it matters**: you check for N+1, client-side evaluation, missing filters, \`SELECT *\` instead of a projection, and whether the generated query can use an index.`,
  },
  {
    id: 'ef-concurrency',
    category: 'EF Core & SQL',
    difficulty: 2,
    question: 'Two people edit the same record at the same time. How do you handle it?',
    tldr: 'Optimistic concurrency: a RowVersion (or concurrency token) column is added to the UPDATE’s WHERE; if 0 rows change, EF throws DbUpdateConcurrencyException and you return 409 or merge. Pessimistic locks only for short, high-contention cases.',
    answer: `**The problem**: a lost update. A and B load version 1; A saves; B saves and silently overwrites A's changes.

**Optimistic concurrency (default choice for web apps)**
\`\`\`csharp
public class Document
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    [Timestamp] public byte[] RowVersion { get; set; } = [];   // SQL Server rowversion
}
\`\`\`
EF generates: \`UPDATE Documents SET Title = @p0 WHERE Id = @p1 AND RowVersion = @p2\`. If another user changed the row, 0 rows are affected and EF throws \`DbUpdateConcurrencyException\`.

\`\`\`csharp
try { await db.SaveChangesAsync(ct); }
catch (DbUpdateConcurrencyException ex)
{
    var entry = ex.Entries.Single();
    var dbValues = await entry.GetDatabaseValuesAsync(ct);
    // options: return 409 Conflict with the current values, let the user merge,
    // or apply a rule (client wins / database wins)
    return Results.Conflict();
}
\`\`\`
**In an API**: send the RowVersion to the client (or as an **ETag**), require it back on PUT (\`If-Match\`), return **409 / 412** on a mismatch.

**Pessimistic locking**: \`SELECT ... WITH (UPDLOCK, ROWLOCK)\` inside a transaction, so others wait. Only for short critical sections with high contention (e.g. reserving the last ticket). It reduces throughput and risks deadlocks.

**Alternatives**: atomic updates (\`ExecuteUpdate(s => s.SetProperty(x => x.Stock, x => x.Stock - 1))\` with a \`WHERE Stock > 0\`), or designing the domain so that conflicts are rare.`,
    followUps: [
      { q: 'What if the database is not SQL Server (no rowversion)?', a: 'Use `[ConcurrencyCheck]` on a property or `IsConcurrencyToken()` on a Guid/int version column that you change on every update (PostgreSQL can use the `xmin` system column).' },
    ],
  },
  {
    id: 'ef-repository',
    category: 'EF Core & SQL',
    difficulty: 2,
    question: 'Do you put the Repository pattern on top of EF Core? Why or why not?',
    tldr: 'DbContext already is a unit of work and DbSet a repository, so a generic repository just hides IQueryable and EF features; I use specific aggregate repositories on the write side (DDD) and query the DbContext directly (or via read models) on the read side.',
    answer: `**Arguments against a generic \`IRepository<T>\`**
- \`DbContext\` = Unit of Work, \`DbSet<T>\` = Repository. Wrapping them adds a layer that does nothing.
- Generic \`GetAll()\` / \`Find(Expression)\` either leaks \`IQueryable\` (so the abstraction is fake) or blocks EF features: projections, \`Include\`, \`AsNoTracking\`, split queries, \`ExecuteUpdate\`.
- "We can swap the ORM" almost never happens; a database swap changes much more than the repository.
- Testing: mocking a repository gives false confidence; integration tests with a real database test the actual queries.

**Arguments for (and where I use it)**
- **Aggregate-specific repositories** in DDD / Clean Architecture: \`IOrderRepository.GetAsync(id)\` loads the whole aggregate with the right Includes, \`Add\`, and nothing else. It expresses the domain, keeps the Domain/Application layer free of EF, and centralises how the aggregate is loaded.
- Encapsulating complex or reused queries (or using the **Specification** pattern).

**What I do in practice (CQRS)**
- **Commands** (write side): specific repository per aggregate, \`SaveChanges\` once per command (often in a pipeline behavior / unit of work).
- **Queries** (read side): handlers use the \`DbContext\` directly (or Dapper / a view) with projections and \`AsNoTracking\` — no repository.

Saying "it depends, and here is my rule" is the senior answer; dogmatic "always" or "never" is not.`,
  },
  {
    id: 'ef-slow-query-steps',
    category: 'EF Core & SQL',
    difficulty: 3,
    question: 'A query is slow. What are your steps?',
    tldr: 'Measure first (App Insights / Query Store) and get the real SQL, then read the actual execution plan (scans, key lookups, bad estimates), fix the query shape or add the right index, and verify with numbers — before reaching for caching.',
    answer: `1. **Confirm and measure**: which endpoint, how slow (p95/p99), always or under load? Application Insights dependency durations, Query Store top queries.
2. **Get the real SQL**: \`ToQueryString()\`, SQL logs, or Query Store. Check what EF generated: N+1, \`SELECT *\` instead of a projection, a missing \`WHERE\`, client evaluation, huge \`IN\` lists, cartesian explosion from Includes.
3. **Execution plan** (actual, not estimated):
   - **Table / Index Scan** on a big table where you expect a Seek → missing or unusable index.
   - **Key Lookup** for every row → make the index covering (\`INCLUDE\` columns).
   - Big difference between **estimated and actual rows** → stale statistics or parameter sniffing.
   - Sort / Hash spills to tempdb, implicit conversions (e.g. \`nvarchar\` parameter against a \`varchar\` column kills index use).
4. **Fix**, from cheapest:
   - Query shape: projection, filter early, pagination (keyset for deep pages), \`AsNoTracking\`, \`AsSplitQuery\`.
   - **Indexes**: composite index matching WHERE + ORDER BY, covering index. Non-sargable predicates (\`WHERE YEAR(Date) = 2026\`, functions on columns, leading \`%\` in LIKE) → rewrite.
   - Statistics update, parameter sniffing (\`OPTION (RECOMPILE)\` / plan guides as a last resort).
   - Locking / blocking: check waits, maybe the query is waiting, not working.
5. **Bigger changes**: denormalised read model, materialised / indexed view, cache, read replica.
6. **Verify**: compare before/after duration and logical reads, and keep a regression check.`,
    followUps: [
      { q: 'What is parameter sniffing?', a: 'SQL Server compiles a plan for the first parameter values it sees and reuses it. If those were atypical (a customer with 3 rows vs one with 3 million), the cached plan is bad for others. Fixes: OPTION (RECOMPILE), OPTIMIZE FOR, separate queries, or better indexes.' },
    ],
  },
  {
    id: 'sql-clustered-nonclustered',
    category: 'EF Core & SQL',
    difficulty: 2,
    question: 'What is the difference between a clustered and a non-clustered index? Does an index always help?',
    tldr: 'The clustered index is the table itself sorted by its key (one per table); a non-clustered index is a separate B-tree with the key plus a pointer to the row. Indexes speed up reads but cost writes and storage, and are useless for unselective or non-sargable queries.',
    answer: `**Clustered index**
- The leaf level **is the data**: rows are physically ordered by the clustered key. Only **one** per table (usually the primary key).
- Good key: narrow, unique, ever-increasing, static (\`int\`/\`bigint\` identity, sequential GUID). Random GUIDs cause page splits and fragmentation.

**Non-clustered index**
- Separate B-tree: index key + **row locator** (the clustered key). Many per table.
- If the query needs columns not in the index → **Key Lookup** into the clustered index for each row. A **covering index** (\`INCLUDE (Col1, Col2)\`) avoids it.
\`\`\`sql
CREATE NONCLUSTERED INDEX IX_Orders_CustomerId_Date
ON Orders (CustomerId, OrderDate DESC) INCLUDE (Total, Status);
\`\`\`
- **Composite** index column order matters: equality columns first, then range / sort. It helps queries that filter by the leftmost column(s).

**When an index does NOT help (or hurts)**
- Low selectivity (e.g. \`IsDeleted\` where 99% are false) → the optimiser scans anyway; consider a **filtered index**.
- Non-sargable predicates: functions on the column, implicit conversions, \`LIKE '%abc'\`.
- Every index slows down **INSERT/UPDATE/DELETE** and takes space and memory.
- Small tables: a scan is cheaper.
- Too many overlapping indexes: maintenance cost, the optimiser may pick badly.

In EF Core: \`modelBuilder.Entity<Order>().HasIndex(o => new { o.CustomerId, o.OrderDate }).IncludeProperties(o => new { o.Total })\`.`,
  },
  {
    id: 'sql-top-n-per-group',
    category: 'EF Core & SQL',
    difficulty: 2,
    question: 'Write a query: the top 3 orders per customer (window functions).',
    tldr: 'Use ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY Total DESC) in a CTE and filter rn <= 3; know the difference between ROW_NUMBER, RANK and DENSE_RANK for ties.',
    answer: `\`\`\`sql
WITH Ranked AS (
    SELECT  o.CustomerId,
            o.Id,
            o.Total,
            o.OrderDate,
            ROW_NUMBER() OVER (PARTITION BY o.CustomerId
                               ORDER BY o.Total DESC, o.OrderDate DESC) AS rn
    FROM Orders o
)
SELECT r.CustomerId, c.Name, r.Id, r.Total
FROM Ranked r
JOIN Customers c ON c.Id = r.CustomerId
WHERE r.rn <= 3
ORDER BY r.CustomerId, r.rn;
\`\`\`

**Window functions to know**
- \`ROW_NUMBER()\`: 1,2,3,4 — unique even on ties (add a tie-breaker to make it deterministic).
- \`RANK()\`: 1,2,2,4 — ties share a rank, gaps after.
- \`DENSE_RANK()\`: 1,2,2,3 — no gaps. "Top 3 distinct amounts" → DENSE_RANK.
- \`SUM(Total) OVER (PARTITION BY CustomerId ORDER BY OrderDate)\`: running total; \`LAG/LEAD\` for the previous/next row.

**Alternative**: \`CROSS APPLY (SELECT TOP 3 ... WHERE o.CustomerId = c.Id ORDER BY Total DESC)\` — fast with an index on \`(CustomerId, Total DESC)\` when there are few customers.

**In EF Core** (EF 8+ translates this pattern):
\`\`\`csharp
var top = await db.Customers
    .Select(c => new { c.Name, Top = c.Orders.OrderByDescending(o => o.Total).Take(3).ToList() })
    .ToListAsync(ct);
\`\`\`

**Related basics**: \`GROUP BY\` + \`HAVING\` for aggregates per group; a CTE makes multi-step queries readable (and can be recursive for hierarchies).`,
    followUps: [
      { q: 'What is the difference between WHERE and HAVING?', a: 'WHERE filters rows before grouping; HAVING filters groups after aggregation (e.g. HAVING COUNT(*) > 5). Window functions are evaluated after WHERE/GROUP BY, which is why you filter on rn in an outer query or CTE.' },
    ],
  },
  {
    id: 'ef-migrations-production',
    category: 'EF Core & SQL',
    difficulty: 3,
    question: 'How do you safely deploy database migrations to production?',
    tldr: 'Review the generated SQL, run migrations as an explicit pipeline step (idempotent script or migration bundle), never from app startup on many instances, and make changes backward-compatible with expand/contract so old and new app versions work during the rollout.',
    answer: `**Creating and reviewing**
- \`dotnet ef migrations add AddOrderStatus\` → **review the generated code and SQL**. EF may drop and recreate a column when you rename a property (data loss!) — fix with \`RenameColumn\`.
- \`dotnet ef migrations script --idempotent\` produces a script that can run on any database state.
- Rollback: \`dotnet ef database update PreviousMigration\` runs the \`Down\` methods, but in production **roll forward** with a new migration is usually safer — \`Down\` cannot bring back dropped data.

**How to apply them**
- As a **separate CI/CD step** before the new app version starts: an idempotent SQL script, or an **EF migration bundle** (\`dotnet ef migrations bundle\`, a self-contained executable).
- **Not** \`Database.Migrate()\` at application startup when there are many instances (race conditions, the app needs DDL permissions, slow start, failed migration = app that won't start).
- Backup / point-in-time restore available, tested on a copy of production data (staging).

**Zero-downtime: expand / contract**
During a rolling or blue-green deploy, the old and the new app run against the **same** database. So every migration must be compatible with both:
1. **Expand**: add the new column (nullable or with a default), new table. Deploy app v2 that writes both old and new.
2. **Migrate data** in batches (not one giant UPDATE that locks the table).
3. Switch reads to the new column.
4. **Contract**: in a later release remove the old column once nothing uses it.

**Watch out for**: long-running locks (adding an index → \`ONLINE = ON\` in Enterprise/Azure SQL), large table rewrites, timeouts on the migration step.

**From my work**: [your example — e.g. how migrations ran in your Azure DevOps pipeline and what you would improve].`,
  },
  {
    id: 'sql-isolation-levels-dotnet',
    category: 'EF Core & SQL',
    difficulty: 3,
    question: 'What transaction isolation levels do you know? How do transactions work in EF Core?',
    tldr: 'Read Uncommitted, Read Committed (SQL Server default), Repeatable Read, Serializable, plus Snapshot / RCSI based on row versioning; higher levels prevent more anomalies (dirty, non-repeatable, phantom reads) at the cost of locking. In EF, one SaveChanges is already a transaction.',
    answer: `| Level | Dirty read | Non-repeatable read | Phantom |
|---|---|---|---|
| Read Uncommitted | possible | possible | possible |
| Read Committed (default) | no | possible | possible |
| Repeatable Read | no | no | possible |
| Serializable | no | no | no |
| Snapshot | no | no | no (but update conflicts) |

- **Dirty read**: you see uncommitted data that may be rolled back.
- **Non-repeatable read**: you read a row twice and its values changed.
- **Phantom**: a re-run range query returns new rows.

**Row versioning**: **Read Committed Snapshot (RCSI)** — readers do not block writers and vice versa, they read the last committed version (default in Azure SQL). **Snapshot** gives a consistent view for the whole transaction and fails on write conflicts.

**Deadlocks**: two transactions lock resources in opposite order; SQL Server kills one (error 1205). Prevention: access tables in the same order, keep transactions short, good indexes (fewer locks), retry the victim.

**Transactions in EF Core**
- A single \`SaveChanges\` is atomic: it runs in a transaction automatically → it is your **unit of work**.
- Several \`SaveChanges\` or raw SQL in one unit:
\`\`\`csharp
await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);
// ... SaveChangesAsync, ExecuteUpdateAsync ...
await tx.CommitAsync(ct);
\`\`\`
- With retrying execution strategies (\`EnableRetryOnFailure\`) wrap the transaction in \`db.Database.CreateExecutionStrategy().ExecuteAsync(...)\`.
- \`ExecuteUpdate\` / \`ExecuteDelete\` (EF 7+) run immediately, outside the change tracker — set-based bulk operations.

**Normalisation vs denormalisation**: normalise (3NF) for the write model to avoid anomalies; denormalise deliberately for read performance (read models, reporting tables), knowing you must keep the copies consistent.`,
  },

  // =====================================================================
  // ARCHITECTURE & PATTERNS
  // =====================================================================
  {
    id: 'arch-solid-dotnet',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'Explain SOLID with examples from your own projects.',
    tldr: 'Five principles that keep code easy to change: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion — explain each with a concrete .NET example and when following it too strictly becomes over-engineering.',
    answer: `**S — Single Responsibility Principle**: a class has one reason to change (one actor it serves).
- Example: a controller that validated input, calculated prices, saved to the DB and sent e-mails was split into a validator, a domain service, a repository and a notification handler. In CQRS each **command handler** does one use case.

**O — Open/Closed Principle**: open for extension, closed for modification.
- Example: instead of a growing \`switch (exportType)\`, an \`IExporter\` interface with \`PdfExporter\`, \`CsvExporter\` registered in DI; a new format = a new class. **MediatR pipeline behaviors** add logging/validation without touching handlers.

**L — Liskov Substitution Principle**: a subtype must be usable wherever the base type is expected, without surprises.
- Violation: a \`ReadOnlyRepository : Repository\` that throws \`NotSupportedException\` from \`Add\`. Or \`Square : Rectangle\`. Fix: model capabilities with separate interfaces.

**I — Interface Segregation Principle**: clients should not depend on methods they do not use.
- Example: split a fat \`IUserService\` (20 methods) into \`IUserQueries\` and \`IUserCommands\`, or small role interfaces. Smaller interfaces are also easier to fake in tests.

**D — Dependency Inversion Principle**: high-level policy depends on abstractions, not on details.
- Example: Application layer defines \`IEmailSender\` / \`IBlobStorage\`; Infrastructure implements them with SendGrid / Azure Blob. Wired up in DI. That is the core of Clean Architecture.
- DIP ≠ DI: DI (the container) is a tool to apply DIP.

**Senior nuance**
- SOLID is a means, not a goal. An interface for every class "just in case" violates **KISS/YAGNI**.
- **DRY**: don't duplicate *knowledge*; two similar-looking pieces of code that change for different reasons are not duplication.
- **Composition over inheritance**: inject behaviour (strategy, decorator) instead of deep class hierarchies.

**Prepare**: one real example per letter from your projects (Package Management System / Incident Logging System).`,
    followUps: [
      { q: 'Which SOLID principle do you think is most often violated?', a: 'SRP: god services and controllers. And DIP in the form of `new`-ing infrastructure (HttpClient, DbContext, DateTime.Now) inside business logic, which also kills testability.' },
      { q: 'Is a static helper class a SOLID violation?', a: 'Pure stateless functions (e.g. string formatting) are fine. A static class that hides I/O, time or configuration is a hidden dependency: it violates DIP and makes tests hard.' },
    ],
  },
  {
    id: 'arch-cqrs-why',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'What is CQRS? Why did you move to CQRS in the Incident Logging System and what did it give you?',
    tldr: 'CQRS separates commands (change state, return little) from queries (return data, no side effects), each with its own model and handlers; it gave us small focused handlers, read queries optimised independently, and cross-cutting concerns via pipeline behaviors.',
    answer: `**CQRS: Command Query Responsibility Segregation**
- **Command**: intent to change state (\`CreateIncidentCommand\`). Validated, goes through domain logic, returns an id/result only.
- **Query**: reads data (\`GetIncidentsQuery\`). No side effects, returns DTOs shaped for the UI.
- Separate models: the write side uses rich entities/aggregates, the read side uses projections (\`AsNoTracking\`, Dapper, views).
- Levels: just separate classes/handlers in one database (most common) → separate read store updated by events → with Event Sourcing (rare).

\`\`\`csharp
public record CreateIncidentCommand(string Title, Severity Severity) : IRequest<Guid>;

public class CreateIncidentHandler(AppDbContext db) : IRequestHandler<CreateIncidentCommand, Guid>
{
    public async Task<Guid> Handle(CreateIncidentCommand cmd, CancellationToken ct)
    {
        var incident = Incident.Report(cmd.Title, cmd.Severity);   // domain logic
        db.Incidents.Add(incident);
        await db.SaveChangesAsync(ct);
        return incident.Id;
    }
}
\`\`\`

**Your story (STAR) — fill in the details**
- **Situation**: [Incident Logging System: what the code looked like before — large services, mixed reads and writes, hard to test / extend?]
- **Task**: [what you were responsible for in the change]
- **Action**: introduced commands/queries with MediatR, one handler per use case, validation in a pipeline behavior, read queries as projections…
- **Result**: [measurable: easier onboarding, faster features, fewer regressions, faster list endpoints…] + what you would do differently.

**Benefits to name**: SRP per use case, easy to find code, independent optimisation of reads, consistent cross-cutting behaviour, testable handlers.`,
  },
  {
    id: 'arch-cqrs-mediatr-downsides',
    category: 'Architecture & Patterns',
    difficulty: 3,
    question: 'What are the downsides of CQRS and MediatR? When would you not use them?',
    tldr: 'More files and indirection, harder navigation ("where is this handled?"), a temptation to call handlers from handlers, and for a separate read store — eventual consistency; for simple CRUD a plain service is better. MediatR is also commercially licensed since v13.',
    answer: `**CQRS costs**
- More classes per feature (command, handler, validator, DTO) → overhead for simple CRUD.
- With a **separate read store**: eventual consistency (the user saves and the list does not show it yet), synchronisation, replaying events, more infrastructure.
- Teams sometimes apply it everywhere "because architecture" — ceremony without benefit.

**MediatR criticism**
- **Indirection**: \`_mediator.Send(cmd)\` hides which code runs; "go to definition" lands in the library. It's essentially a service locator for handlers.
- It is in-process: not a message bus, no durability or retries. People confuse \`INotification\` with real events.
- Handlers calling \`Send\` on other handlers → hidden coupling and nested transactions.
- Runtime cost is small but non-zero (reflection/allocation), rarely relevant.
- **Licensing**: since 2025 (v13) MediatR is commercial for larger companies — a real argument when choosing it in a new project.

**Alternatives**: plain application services or handler interfaces injected directly (\`ICommandHandler<T>\`), decorators via Scrutor for cross-cutting concerns, Minimal API endpoints calling a handler, or alternatives like Wolverine / source-generated mediators.

**When I would NOT use them**
- Small CRUD apps, prototypes, small teams with short-lived projects.
- When the domain is simple and reads ≈ writes.
- I'd still keep the *idea* (separate read and write paths, projections for reads) without the library.

**When they shine**: complex domains, many use cases, consistent cross-cutting needs (validation, auditing, transactions), larger teams.`,
  },
  {
    id: 'arch-mediatr-behaviors',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'What are MediatR pipeline behaviors and what do you use them for?',
    tldr: 'IPipelineBehavior<TRequest,TResponse> wraps every handler like middleware (decorator pattern): validation, logging, performance timing, transactions/unit of work, caching, authorisation — registered once instead of repeated in every handler.',
    answer: `\`\`\`csharp
public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var failures = (await Task.WhenAll(validators.Select(v => v.ValidateAsync(request, ct))))
            .SelectMany(r => r.Errors).Where(e => e is not null).ToList();
        if (failures.Count > 0) throw new ValidationException(failures);
        return await next();                               // call the next behavior / the handler
    }
}

services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));      // outermost
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
    cfg.AddOpenBehavior(typeof(TransactionBehavior<,>));  // innermost, closest to the handler
});
\`\`\`

**Typical behaviors**
- **Validation** (FluentValidation) → turned into 400 ProblemDetails by the exception handler.
- **Logging / timing**: request name, duration, warn if slower than X ms.
- **Transaction / Unit of Work**: only for commands (marker interface \`ICommand\`), \`SaveChanges\` + commit, dispatch domain events / write outbox.
- **Authorisation** per request, **caching** for queries (marker \`ICacheableQuery\`), **idempotency** keys.

**Order matters** — the registration order is the nesting order, like middleware.

**Behaviors vs ASP.NET filters/middleware**: behaviors run for every request regardless of the entry point (HTTP, background job, message consumer), so the use-case pipeline is the same everywhere.`,
  },
  {
    id: 'arch-clean-architecture',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'Describe Clean Architecture. Where does the business logic go?',
    tldr: 'Concentric layers — Domain, Application, Infrastructure, Presentation/API — with dependencies pointing inward only; business rules live in the Domain (entities, value objects) and use-case orchestration in Application, while EF Core, HTTP and Azure SDKs stay in Infrastructure.',
    answer: `**Layers (typical .NET solution)**
- **Domain**: entities, aggregates, value objects, domain events, domain services, business invariants. No references to EF, ASP.NET or any framework.
- **Application**: use cases (commands/queries + handlers), interfaces for what it needs (\`IAppDbContext\`, \`IEmailSender\`, \`IClock\`), DTOs, validation. Depends only on Domain.
- **Infrastructure**: EF Core DbContext and configurations, repositories, Azure Blob/Service Bus clients, e-mail, external APIs. Implements Application interfaces.
- **Presentation / API**: controllers or Minimal APIs, auth, DI composition root. Thin: map HTTP → command → HTTP.

**The Dependency Rule**: source-code dependencies point **inward**. Infrastructure depends on Application, never the other way round. Inversion through interfaces + DI.

**Where business logic goes**
- **Invariants and rules** in the Domain: \`order.AddLine()\` checks limits, \`incident.Close()\` validates status transitions — not \`if\`s scattered across controllers.
- **Orchestration** in Application handlers: load aggregate → call domain method → save → publish event.
- An **anemic domain model** (entities = property bags, all logic in services) is a common smell.

**Onion / Hexagonal** are the same idea: core in the middle, adapters around it (ports & adapters).

**Trade-offs**
- More projects and mapping, more ceremony. For a simple CRUD service a **vertical slice** structure (feature folders: endpoint + handler + DTO together) is often more pragmatic.
- Pragmatic shortcuts are common: using EF Core entities as domain entities, letting Application use \`DbContext\` through an interface.`,
    followUps: [
      { q: 'Clean Architecture vs Vertical Slice Architecture?', a: 'Clean Architecture slices by technical layer; Vertical Slice slices by feature (each feature owns its request, handler, data access). VSA reduces cross-file jumping and shared abstractions; many teams combine them: a shared Domain + vertical slices in Application.' },
    ],
  },
  {
    id: 'arch-monolith-microservices-dotnet',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'Monolith or microservices: what would you start a new project with?',
    tldr: 'Usually a modular monolith: one deployable with strict module boundaries (own data, internal APIs), which is cheap to run and can be split later; microservices pay off only with independent teams, very different scaling needs or deployment cadence — and they cost a lot operationally.',
    answer: `**Monolith**
- + simple deployment, debugging, transactions, refactoring; one database; low ops cost.
- − without discipline becomes a "big ball of mud"; one team's change redeploys everything; scaling is all-or-nothing.

**Modular monolith (my default for a new product)**
- One deployable, but split into **modules by bounded context** (e.g. Forms, Users, Notifications), each with its own folder/projects, own schema/tables, public contracts; no reaching into another module's tables.
- Modules talk via interfaces or in-process events. Boundaries can be enforced with architecture tests (NetArchTest).
- Later, a module with a real reason can be extracted into a service — the seams already exist.

**Microservices**
- + independent deployment and scaling, team autonomy, technology freedom, fault isolation.
- − network calls (latency, failures → retries, circuit breakers), **distributed data** (no joins, eventual consistency, sagas, outbox), distributed tracing, versioned contracts, many pipelines, Kubernetes/Container Apps, on-call complexity.
- Requires mature DevOps and observability. A "distributed monolith" (services that must be deployed together) is the worst of both worlds.

**Decision drivers**: team size and number of teams (Conway's law), domain understanding (unclear boundaries → don't split yet), scaling profile, compliance/isolation needs.

**Strangler fig** for legacy migrations: put a facade/proxy (e.g. YARP) in front, move one route/feature at a time to the new system, until the old one can be switched off.`,
  },
  {
    id: 'arch-ddd-aggregate',
    category: 'Architecture & Patterns',
    difficulty: 3,
    question: 'What is an aggregate in DDD? Value object vs entity?',
    tldr: 'An entity has identity that persists over time; a value object is defined only by its values and is immutable; an aggregate is a cluster of them with one root that enforces invariants and is the unit of loading, saving and transactional consistency.',
    answer: `**Entity**: identity matters (\`Order #123\` is the same order even when its status changes). Equality by Id. Mutable through behaviour methods.

**Value object**: no identity; equal if all values are equal; **immutable**; validated on creation.
\`\`\`csharp
public sealed record Money
{
    public decimal Amount { get; }
    public string Currency { get; }
    public Money(decimal amount, string currency)
    {
        if (amount < 0) throw new ArgumentException("Negative amount");
        (Amount, Currency) = (amount, currency);
    }
    public Money Add(Money other) => other.Currency == Currency
        ? new Money(Amount + other.Amount, Currency)
        : throw new InvalidOperationException("Currency mismatch");
}
\`\`\`
Examples: Money, Address, Email, DateRange. Kills "primitive obsession". In EF Core: owned types or complex types (EF 8).

**Aggregate**
- A consistency boundary: e.g. \`Order\` (root) + \`OrderLines\`. Outside code references only the **root** and changes the aggregate only through its methods (\`order.AddLine(...)\`), so invariants ("max 50 lines", "total ≤ credit limit") are always checked.
- One transaction = one aggregate. Other aggregates are referenced **by Id**, not by navigation, and updated via **domain events** (eventual consistency).
- Keep aggregates **small**; a huge aggregate means contention and slow loading.

\`\`\`csharp
public class Order : AggregateRoot
{
    private readonly List<OrderLine> _lines = [];
    public IReadOnlyCollection<OrderLine> Lines => _lines;
    public void AddLine(ProductId productId, int qty, Money price)
    {
        if (Status != OrderStatus.Draft) throw new DomainException("Order is not editable");
        _lines.Add(new OrderLine(productId, qty, price));
        AddDomainEvent(new OrderLineAdded(Id, productId));
    }
}
\`\`\`

**Bounded context**: a boundary in which a model and its language are consistent ("Customer" in Billing ≠ "Customer" in Support). Often maps to a module or a service.

**Domain events**: something that happened in the domain (\`IncidentEscalated\`), raised by the aggregate, dispatched after save (in-process) or published via the outbox (integration events).`,
  },
  {
    id: 'arch-outbox-dotnet',
    category: 'Architecture & Patterns',
    difficulty: 3,
    question: 'How do you make sure an event is published if (and only if) the database write succeeded? (Outbox)',
    tldr: 'Transactional outbox: save the business change and the event row in the same database transaction, then a background dispatcher publishes outbox rows to Service Bus and marks them sent — giving at-least-once delivery, so consumers must be idempotent.',
    answer: `**The dual-write problem**
\`\`\`csharp
await db.SaveChangesAsync();       // succeeds
await bus.PublishAsync(evt);       // fails / the process crashes → event lost
\`\`\`
Reversing the order is no better: event published, DB write fails → consumers act on something that never happened. There is no distributed transaction between SQL and Service Bus.

**Outbox**
1. In the **same transaction** as the business change, insert a row into \`OutboxMessages\` (Id, Type, Payload JSON, OccurredAt, ProcessedAt).
\`\`\`csharp
db.Orders.Add(order);
db.OutboxMessages.Add(OutboxMessage.From(new OrderPlaced(order.Id)));
await db.SaveChangesAsync(ct);          // both or nothing
\`\`\`
   Often done automatically: a SaveChanges interceptor turns domain events collected on aggregates into outbox rows.
2. A **dispatcher** (\`BackgroundService\`, Azure Function timer, or CDC) reads unprocessed rows, publishes to Service Bus, sets \`ProcessedAt\`.
3. If publishing succeeds but marking fails, the message is sent again → **at-least-once** → consumers need idempotency (use the message Id; Service Bus duplicate detection helps too).

**Details a senior mentions**
- Ordering per aggregate, batching, retries with backoff, poison messages, cleanup of old rows.
- Multiple dispatcher instances: lock rows (\`UPDLOCK, READPAST\`) or a single-instance lease.
- **Inbox** pattern on the consumer side: store processed message Ids in the same transaction as the side effect.
- Libraries: MassTransit, NServiceBus, Wolverine have outbox/inbox built in.`,
  },
  {
    id: 'arch-idempotency-queues',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'What is idempotency and why is it important with queues?',
    tldr: 'An operation is idempotent if doing it twice has the same effect as once; message brokers deliver at-least-once (retries, redeliveries after lock expiry, outbox re-sends), so consumers must tolerate duplicates.',
    answer: `**Why duplicates happen**
- Service Bus **peek-lock**: the consumer processes the message but crashes / the lock expires before \`Complete\` → redelivered.
- Producer retries after a timeout even though the first send succeeded.
- Outbox dispatcher re-publishes after a failure.
- Exactly-once delivery is practically impossible across systems; aim for **exactly-once processing effects**.

**Techniques**
- **Natural idempotency**: \`SET Status = 'Paid'\` instead of \`Balance = Balance - 10\`; upserts.
- **Deduplication store (inbox)**: table \`ProcessedMessages(MessageId PK)\`. In one transaction: insert the Id + do the work; a duplicate violates the PK → skip.
\`\`\`csharp
if (await db.ProcessedMessages.AnyAsync(m => m.Id == msg.MessageId, ct)) return;   // already handled
// ... business change ...
db.ProcessedMessages.Add(new ProcessedMessage(msg.MessageId));
await db.SaveChangesAsync(ct);   // unique constraint protects against a race
\`\`\`
- **Version / state checks**: ignore an event older than the current aggregate version.
- **Service Bus duplicate detection**: drops messages with the same \`MessageId\` within a time window (helps with producer retries, not consumer reprocessing).
- **Idempotency-Key** header for HTTP POST (payments): store the key + response, return the same response on retry.

**Also**: dead-letter queue for poison messages, max delivery count, alerts on DLQ size.`,
  },
  {
    id: 'arch-eventgrid-servicebus',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'Event Grid vs Service Bus vs Event Hubs: when do you use which?',
    tldr: 'Service Bus = reliable enterprise messaging (commands, queues/topics, ordering with sessions, transactions, DLQ); Event Grid = lightweight push-based routing of discrete events ("something happened", e.g. blob created); Event Hubs = high-throughput streaming of telemetry/logs with replay.',
    answer: `| | Service Bus | Event Grid | Event Hubs |
|---|---|---|---|
| Model | queues & topics (pull) | pub/sub, push to handlers | partitioned log (stream) |
| Message | command / business message | event notification (small) | telemetry, high volume |
| Guarantees | at-least-once, FIFO with sessions, DLQ, transactions, duplicate detection, scheduled messages | at-least-once, retries with backoff, dead-lettering to a blob | ordered per partition, retention + replay, consumer groups |
| Scale | thousands/s | millions of events, very cheap per event | millions/s |
| Typical use | order processing, workflows, integration between services | react to Azure resource events (Blob created, Key Vault secret expiring), fan-out webhooks | IoT, clickstream, logs → analytics |

**Queue vs topic**
- **Queue**: one logical consumer (competing consumers for load balancing) → commands, work distribution.
- **Topic + subscriptions**: each subscription gets a copy (with SQL/correlation filters) → events, fan-out to many services.

**Rules of thumb**
- "Do this" with business value and you cannot lose it → **Service Bus**.
- "This happened" and you want reactive, serverless handlers (Azure Functions) → **Event Grid**.
- Continuous stream to analyse → **Event Hubs** (or Kafka API on Event Hubs).
- Storage Queues: very simple and cheap, no topics/sessions/DLQ niceties.

**From your CV**: [how you used Event Grid — e.g. blob upload → Event Grid → Function processing; why Event Grid there and not Service Bus].`,
  },
  {
    id: 'arch-netfx-migration',
    category: 'Architecture & Patterns',
    difficulty: 3,
    question: 'How did you migrate from .NET Framework to .NET 5+? What problems did you hit?',
    tldr: 'Assess dependencies first (Upgrade Assistant / API analyzers), move libraries to netstandard2.0 or multi-target, convert to SDK-style projects, replace unsupported pieces (System.Web, WCF server, Web.config, EF6), migrate incrementally (strangler fig with YARP) and lean on tests.',
    answer: `**Typical approach**
1. **Inventory**: projects, NuGet packages and whether they support .NET (Core); use the **.NET Upgrade Assistant** and the API Portability analyzer.
2. **SDK-style csproj** and \`PackageReference\` instead of \`packages.config\`.
3. **Libraries first**: retarget shared libraries to \`netstandard2.0\` or multi-target (\`net48;net8.0\`) so both old and new apps can use them.
4. **Web app**: ASP.NET MVC/Web API → ASP.NET Core: \`Global.asax\`/HTTP modules → middleware, \`Web.config\` → \`appsettings.json\` + Options, built-in DI instead of Unity/Autofac (or keep Autofac), \`HttpContext.Current\` → \`IHttpContextAccessor\`/injection.
5. **Incremental migration**: run old and new side by side behind **YARP** (strangler fig), move routes one by one, share auth cookies/session.
6. Tests and a comparison of behaviour between the two versions; performance tests.

**Common problems**
- \`System.Web\` dependencies everywhere; WCF **server** not supported (CoreWCF or move to REST/gRPC).
- EF6 → EF Core: different behaviour (no lazy loading by default, query translation differences, client evaluation now throws), \`EDMX\` not supported.
- Windows-only APIs (registry, \`System.Drawing\` on Linux), AppDomains, remoting, binary serialisation.
- Configuration and secrets, authentication (Forms auth / OWIN → cookie/JWT/Entra ID).
- Third-party libraries without a .NET Core version → replace or wrap.

**Your story (STAR)**: [scope of the app, how long it took, the hardest problem — e.g. a dependency you had to replace — and the result: performance gain, hosting on Linux containers / Azure App Service, newer C#].`,
  },
  {
    id: 'arch-patterns-real',
    category: 'Architecture & Patterns',
    difficulty: 2,
    question: 'Give an example of a design pattern you really used. Which patterns do you know?',
    tldr: 'Pick 2–3 you actually used (e.g. Strategy for interchangeable rules, Decorator for caching/retry around a service, Factory for creating clients, Mediator via MediatR) and explain the problem it solved and when it would be overkill.',
    answer: `**Patterns worth explaining with .NET examples**
- **Strategy**: interchangeable algorithms behind one interface. \`IDiscountStrategy\`, \`INotificationChannel\` (email/SMS/push) resolved by key: \`IEnumerable<IChannel>\` or **keyed services** (\`[FromKeyedServices("sms")]\`, .NET 8).
- **Decorator**: add behaviour without changing the class: \`CachedProductRepository\` wrapping \`ProductRepository\`, retry/log decorators (Scrutor \`Decorate<>\`). MediatR behaviors and \`DelegatingHandler\` in HttpClient are decorators too.
- **Factory**: encapsulate creation: \`IHttpClientFactory\`, \`IDbContextFactory<T>\`, creating the right parser for a file type.
- **Adapter**: wrap an external/legacy API behind your interface (e.g. an \`IOstClient\` over a third-party SOAP/REST service).
- **Mediator**: MediatR decouples senders from handlers.
- **Observer**: C# events, \`IObservable\`, domain events / pub-sub.
- **Builder**: step-by-step construction: \`WebApplication.CreateBuilder\`, test data builders.
- **Singleton**: one instance — in .NET use the DI lifetime, not a static \`Instance\` (testability, thread safety).
- **Template Method / Chain of Responsibility**: middleware pipeline, validation chains.

**How to answer** (STAR-lite): problem → why this pattern → the code shape → result → when it would be overkill.

\`\`\`csharp
builder.Services.AddKeyedScoped<INotificationChannel, EmailChannel>("email");
builder.Services.AddKeyedScoped<INotificationChannel, SmsChannel>("sms");

public class Notifier(IServiceProvider sp)
{
    public Task SendAsync(string channel, Message m, CancellationToken ct) =>
        sp.GetRequiredKeyedService<INotificationChannel>(channel).SendAsync(m, ct);
}
\`\`\`

**Your example**: [e.g. Strategy for different form/document types in the power-plant forms platform, Adapter for the OST integration — fill in what really happened].`,
  },
]);
