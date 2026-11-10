/*
  .NET TRACK: ANGULAR, SYSTEM DESIGN, LIVE CODING & CODE REVIEW, AI AT WORK
  Format: see the comment at the top of questions.js
*/
addQuestions('dotnet', [
  // =====================================================================
  // ANGULAR (BASICS FOR A BACKEND-LEANING FULL-STACK)
  // =====================================================================
  {
    id: 'ng-change-detection',
    category: 'Angular',
    difficulty: 2,
    question: 'How does change detection work in Angular, and what does OnPush give you?',
    tldr: 'By default Zone.js triggers a check of the whole component tree after every async event; OnPush checks a component only when an @Input reference changes, an event fires inside it, an async pipe/signal it reads emits, or you mark it — fewer checks and it pushes you towards immutable data.',
    answer: `**Default strategy**
- Zone.js patches async APIs (events, timers, XHR). After any of them Angular runs change detection **top-down through the whole tree**, comparing template bindings.
- Simple, but in big trees it does a lot of unnecessary work.

**OnPush**
\`\`\`typescript
@Component({
  selector: 'app-form-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`@for (f of forms(); track f.id) { <app-form-row [form]="f" /> }\`,
})
export class FormListComponent { forms = input.required<Form[]>(); }
\`\`\`
The component (and its subtree) is checked only when:
- an **@Input reference** changes (mutating an array in place does NOT trigger it → use immutable updates),
- a DOM event happens in the component,
- an \`async\` pipe receives a value, or a **signal** read in the template changes,
- \`markForCheck()\` is called.

**Signals and zoneless**: with signals Angular knows exactly which views depend on which values; Angular 18+ can run **zoneless** (\`provideZonelessChangeDetection()\`), the default direction for new apps.

**Lifecycle hooks to know**: \`ngOnInit\` (after first inputs), \`ngOnChanges\`, \`ngAfterViewInit\`, \`ngOnDestroy\` (cleanup). **Standalone components** (no NgModules) are the default since v17.`,
  },
  {
    id: 'ng-rxjs-maps-unsubscribe',
    category: 'Angular',
    difficulty: 2,
    question: 'switchMap vs mergeMap vs concatMap: when do you use which? How do you avoid memory leaks with subscriptions?',
    tldr: 'switchMap cancels the previous inner observable (search-as-you-type), mergeMap runs all in parallel (independent requests), concatMap queues them in order (saves that must not overlap), exhaustMap ignores new ones while busy (login button). Avoid leaks with the async pipe, takeUntilDestroyed or toSignal.',
    answer: `| Operator | Behaviour | Example |
|---|---|---|
| \`switchMap\` | cancel previous, keep latest | typeahead search, route param → load details |
| \`mergeMap\` | all concurrently | upload several files independently |
| \`concatMap\` | one after another, in order | sequential saves / autosave |
| \`exhaustMap\` | ignore new while one is running | submit / login button double-clicks |

\`\`\`typescript
results$ = this.searchControl.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(term => this.api.search(term)),   // stale responses are cancelled
);
\`\`\`

**Avoiding leaks**
- Prefer the **\`async\` pipe** in templates — it subscribes and unsubscribes for you.
- \`takeUntilDestroyed()\` (Angular 16+) in an injection context:
\`\`\`typescript
constructor() {
  this.store.changes$.pipe(takeUntilDestroyed()).subscribe(v => this.update(v));
}
\`\`\`
- \`toSignal(obs$)\` converts to a signal with automatic cleanup.
- HttpClient observables complete after one response, so they don't leak, but long-lived streams (\`valueChanges\`, \`interval\`, store selectors, WebSockets) do.

**Subject types**: \`Subject\` (no initial value), \`BehaviorSubject\` (current value, good for state), \`ReplaySubject\` (replays N values).`,
  },
  {
    id: 'ng-signals-vs-observables',
    category: 'Angular',
    difficulty: 2,
    question: 'What are signals and how do they differ from Observables?',
    tldr: 'A signal is a synchronous reactive value that always has a current value and tracks who reads it (signal, computed, effect); Observables are streams of values over time with powerful async operators. Use signals for UI state, RxJS for async event streams, and bridge with toSignal/toObservable.',
    answer: `\`\`\`typescript
count = signal(0);
double = computed(() => this.count() * 2);       // recomputed only when count changes
constructor() { effect(() => console.log('count is', this.count())); }
increment() { this.count.update(c => c + 1); }
\`\`\`

| | Signal | Observable |
|---|---|---|
| Value | always has a current value, read synchronously \`s()\` | emits over time, may never emit |
| Subscription | automatic dependency tracking | explicit subscribe / unsubscribe |
| Async | no built-in (use \`resource()\` / toSignal) | first-class (HTTP, events, timers) |
| Operators | computed / effect | rich: debounce, switchMap, retry, combineLatest… |
| Change detection | fine-grained, works zoneless | needs async pipe / markForCheck |

**Guideline**: signals for component and app **state** (and \`input()\`, \`model()\`, \`viewChild()\` signal APIs); RxJS where you need **time-based or async composition** (search typeahead, websockets, retries).`,
  },
  {
    id: 'ng-interceptor-guards',
    category: 'Angular',
    difficulty: 2,
    question: 'How do you attach a token to every HTTP request, and how do you protect routes from unauthorised users?',
    tldr: 'A functional HttpInterceptor clones the request with an Authorization header (MSAL provides MsalInterceptor for Entra ID); routes are protected with a CanActivate/CanMatch guard — but guards are only UX, the API must authorise every request itself.',
    answer: `**Interceptor**
\`\`\`typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  if (!req.url.startsWith(environment.apiUrl)) return next(req);   // never leak tokens to other hosts
  return from(auth.getAccessToken()).pipe(
    switchMap(token => next(req.clone({ setHeaders: { Authorization: \`Bearer \${token}\` } }))),
  );
};

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(withInterceptors([authInterceptor]))],
});
\`\`\`
With Entra ID: \`MsalInterceptor\` + \`protectedResourceMap\` (URL → scopes) does this, including silent token renewal. Interceptors are also good for error handling (401 → login, 5xx → toast) and correlation ids.

**Guards**
\`\`\`typescript
export const roleGuard = (role: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  return auth.hasRole(role) ? true : inject(Router).createUrlTree(['/forbidden']);
};

{ path: 'admin', canMatch: [roleGuard('Admin')], loadComponent: () => import('./admin/admin.component') }
\`\`\`
- \`canMatch\` + **lazy loading** means the code for the route isn't even downloaded for unauthorised users.
- **Important**: client-side guards only improve UX — anyone can change JS in the browser. Real enforcement is the API's authorization.

**Forms**: **reactive forms** (FormGroup/FormControl in code, typed, testable, dynamic validation) for anything non-trivial; template-driven for very simple forms.`,
  },

  // =====================================================================
  // SYSTEM DESIGN (.NET / AZURE FLAVOUR)
  // =====================================================================
  {
    id: 'sd-dotnet-approach',
    category: 'System Design (.NET)',
    difficulty: 2,
    question: 'What is your approach (framework) to a system design interview?',
    tldr: 'Clarify functional and non-functional requirements, estimate load, draw the main components and data flow, design the data model and API, then find bottlenecks and scale (cache, queues, replicas), and close with trade-offs and what changes at 10× scale — talking out loud the whole time.',
    answer: `1. **Functional requirements** (3–5 min): what must the system do? Which features are in scope for this interview? Who are the users?
2. **Non-functional requirements**: number of users / requests, data volume and growth, latency targets, availability (99.9%?), consistency needs, security & compliance (GDPR, audit), budget.
3. **Back-of-the-envelope estimates**: e.g. 6,000 users × 20 actions/day ≈ 120k requests/day ≈ 1.4 rps average, peak ×10 = ~15 rps → a single App Service plan handles it; storage = forms × size × retention.
4. **High-level design**: client → (Front Door/CDN) → API → database; async work through a queue → workers; blob storage for files; identity provider.
5. **Data model and API**: main entities and relations, key endpoints (\`POST /forms\`, \`GET /forms?plantId=&status=&page=\`), ids, pagination, idempotency.
6. **Bottlenecks and scaling**: stateless API scale-out, caching (what, where, invalidation), queues to absorb spikes, read replicas, indexing, partitioning.
7. **Reliability and operations**: retries/timeouts/circuit breakers, outbox, monitoring and alerts, backups/DR, deployments.
8. **Trade-offs and 10×**: what you chose and what you gave up; what you would change at 10× or 100× load.

**Tips**: think out loud, ask before assuming, keep it simple first (a monolith + SQL is a valid answer for 6k users), justify every box you draw, and mention security and observability without being asked — that's what seniors do.`,
  },
  {
    id: 'sd-forms-platform',
    category: 'System Design (.NET)',
    difficulty: 3,
    question: 'Design a forms platform for 300 power plants and 6,000 users.',
    tldr: 'Modest load (a few rps) → don’t over-engineer: Angular SPA + ASP.NET Core API (modular monolith) on App Service, Azure SQL, Blob Storage for attachments via SAS, Entra ID with roles and plant-scoped authorization, Service Bus/Functions for notifications and PDF generation, App Insights for monitoring.',
    answer: `**Clarify**: form templates designed by admins? Versioning of templates? Approval workflow? Offline use on site? Attachments/photos? Reporting across plants? Audit trail? Retention?

**Estimates**: 6,000 users, maybe 1,000 concurrently at peak; tens of thousands of submissions per month; attachments dominate storage (photos: GBs per month). Requests per second are low — **correctness, security, auditability** matter more than raw scale.

**Architecture**
- **Angular SPA** (Static Web Apps / CDN), MSAL sign-in with **Entra ID**.
- **ASP.NET Core API** on App Service (2+ instances, slots), modular monolith: Templates, Submissions, Workflow, Users/Plants, Reporting.
- **Azure SQL**: templates (JSON schema, versioned — a submission references the exact template version), submissions (structured columns for what you filter on + JSON for answers), workflow state, audit log.
- **Blob Storage** for attachments: client gets a short-lived **SAS** and uploads directly; Event Grid → Function to scan / generate thumbnails.
- **Service Bus** + Functions: notifications (e-mail/Teams), PDF export, integrations; outbox for reliability.
- **App Insights / OpenTelemetry**, Key Vault + Managed Identity, Bicep, Azure DevOps pipelines.

**Data & API**
- \`Plant\`, \`User–Plant–Role\`, \`FormTemplate(Id, Version, Schema)\`, \`Submission(Id, TemplateId, Version, PlantId, Status, Answers, RowVersion)\`, \`Attachment\`, \`AuditEntry\`.
- \`GET /plants/{id}/submissions?status=&from=&page=\`, \`POST /submissions\` (Idempotency-Key), \`POST /submissions/{id}/approve\` (RowVersion / ETag).

**Security**: plant-scoped **resource-based authorization** (IDOR!), app roles (Operator, Approver, Admin), audit of every change, data encrypted at rest, least privilege.

**Bottlenecks / scaling**: reporting queries → read model / reporting replica; template caching; heavy exports async. Offline mode → local storage + sync with conflict handling (RowVersion).

**Trade-offs**: JSON answers (flexible templates) vs relational columns (easy reporting) → hybrid. 10× scale: read replicas, partition by plant, CDN, separate reporting store.

Since this is **your own project**, explain what you actually built, what you would change, and why.`,
  },
  {
    id: 'sd-notifications',
    category: 'System Design (.NET)',
    difficulty: 3,
    question: 'Design a notification system (e-mail, push) for a large number of users.',
    tldr: 'Producers publish notification requests to a queue/topic; a notification service applies user preferences, templates and rate limits, then fans out to per-channel queues processed by workers calling providers (ACS/SendGrid, FCM/APNs) with retries, idempotency, DLQ and delivery tracking.',
    answer: `**Requirements**: channels (e-mail, push, SMS, in-app), transactional vs bulk/marketing, user preferences and quiet hours, templates & localisation, delivery status, scale (e.g. 10M users, campaigns of 1M messages), at-least-once without spamming duplicates.

**Flow**
1. Services publish \`NotificationRequested { userId, type, data, idempotencyKey }\` to **Service Bus topic** (via outbox).
2. **Notification service**: loads preferences (cached), decides channels, renders the template, checks **rate limits / dedup** (idempotency key in Redis/SQL).
3. Puts messages on **per-channel queues** (email, push, sms) → independent scaling and isolation (a slow SMS provider doesn't block push).
4. **Channel workers** (Functions / Container Apps with KEDA) call providers: Azure Communication Services / SendGrid, FCM/APNs (Notification Hubs). Retries with backoff and respect provider rate limits; **DLQ** for poison messages.
5. Store **delivery status** (sent, delivered, bounced, opened) from provider webhooks; in-app notifications in a DB table + SignalR for real-time.

**Bulk campaigns**: don't enqueue 1M messages from a web request — a scheduler job pages through users in batches; priorities: transactional queue separate from bulk so password resets aren't stuck behind a newsletter.

**Data**: \`UserPreferences\`, \`Templates (versioned, per locale)\`, \`Notifications (id, userId, channel, status, attempts)\`, device tokens (cleanup of invalid tokens).

**Concerns**: idempotency, ordering (rarely needed), unsubscribe / GDPR, monitoring (queue length, failure rate per provider), cost per channel.`,
  },
  {
    id: 'sd-large-files-dotnet',
    category: 'System Design (.NET)',
    difficulty: 3,
    question: 'Design a system for uploading and processing large files.',
    tldr: 'The API never streams the file: it validates the request and returns a short-lived write-only SAS URL; the client uploads directly to Blob Storage in blocks (resumable), Event Grid signals BlobCreated, and workers process asynchronously via a queue, reporting status back.',
    answer: `**Flow**
1. \`POST /uploads\` with file name, size, type → API checks auth, quotas, allowed types; creates an \`Upload\` record (status *Pending*); returns a **user delegation SAS** for one blob, write-only, expiring in minutes.
2. Client uploads **directly to Blob Storage** in blocks (Put Block / Put Block List — the Azure SDK does this with parallelism), so it can **resume** after a network failure and the API servers are not involved in the data path.
3. **Event Grid** \`BlobCreated\` → Service Bus queue → **worker** (Function/Container App): malware scan, validation, processing (thumbnails, parsing, transcoding), stores results, updates status *Processed/Failed*.
4. Client gets status via polling \`GET /uploads/{id}\`, SignalR, or a webhook.
5. Downloads via **read SAS** or CDN, not through the API.

**Details**
- Quarantine container until scanned (Defender for Storage malware scanning); move to the final container after.
- Idempotent processing (at-least-once events), DLQ, retries; large processing → Durable Functions or chunked jobs.
- Limits: max size, content-type checks, never trust the file extension.
- Lifecycle policies: delete abandoned uploads, tier old files to Cool/Archive.
- Metadata in SQL (owner, size, hash for dedup, status); blobs named by GUID, not the user's file name.

**Why not upload through the API**: request size limits, timeouts, memory/thread usage, paying for bandwidth twice, scaling the API for I/O.`,
  },
  {
    id: 'sd-order-tracking',
    category: 'System Design (.NET)',
    difficulty: 3,
    question: 'Design an order and shipment tracking system.',
    tldr: 'Order service owns orders (SQL, state machine), shipment tracking ingests carrier events via webhooks/polling into a queue, updates an append-only tracking history and a read model per order, and pushes status changes to customers — with idempotent event processing and an outbox between services.',
    answer: `**Requirements**: create order, payment, fulfilment, shipments (one order → many parcels), tracking status from carriers, customer notifications, search/history for support; scale e.g. 100k orders/day, carrier event bursts.

**Components**
- **Order API** (ASP.NET Core): order aggregate with a **state machine** (Created → Paid → Packed → Shipped → Delivered / Cancelled), optimistic concurrency, outbox → \`OrderPaid\`, \`OrderShipped\` events on Service Bus.
- **Shipment service**: creates shipments with carriers (adapter per carrier — Strategy/Adapter pattern), stores tracking numbers.
- **Tracking ingestion**: carrier **webhooks** (validate signature) or scheduled polling → queue → workers normalise statuses to a common model, **dedupe** (carrier event id), append to \`TrackingEvents\` (append-only history), update shipment status (ignore out-of-order older events by timestamp/sequence).
- **Read model**: \`OrderTrackingView\` (denormalised, maybe Cosmos DB or a SQL table) for the customer page; cache hot orders.
- **Notifications** on status changes (see notification system).

**API**: \`POST /orders\` (Idempotency-Key), \`GET /orders/{id}\`, \`GET /orders/{id}/tracking\`, \`POST /webhooks/{carrier}\`.

**Concerns**: eventual consistency between order and shipment state, saga for payment → reservation → shipment with compensations (refund), carrier outages (retry, circuit breaker), audit trail, partitioning by order id at high scale.

Link it to your **Package Management System** experience: what you built, statuses, integrations.`,
  },
  {
    id: 'sd-url-shortener-dotnet',
    category: 'System Design (.NET)',
    difficulty: 2,
    question: 'Design a URL shortener (in .NET / Azure).',
    tldr: 'Read-heavy key→URL lookup: generate short codes (Base62 of a unique id or random with collision check), store in a key-value friendly store, serve redirects from a cache/CDN with 301/302, and count clicks asynchronously through a queue.',
    answer: `**Requirements**: create short link (optional custom alias, expiry), redirect fast, click analytics; reads ≫ writes (e.g. 100:1); say 100M links, 10k redirects/s at peak.

**Code generation**
- **Base62 of a unique id** (counter/HiLo/Snowflake-like id) → short, no collisions, but predictable (enumerable).
- **Random 7 chars** of Base62 (62^7 ≈ 3.5 trillion) + check uniqueness via a unique constraint, retry on collision → not guessable.
- Custom alias: unique constraint, reserved words.

**Storage**: \`ShortLinks(Code PK, LongUrl, OwnerId, CreatedAt, ExpiresAt)\` — Azure SQL is fine to a large scale; Cosmos DB / Table Storage with \`Code\` as partition key for massive scale.

**Redirect path** (\`GET /{code}\`): Redis / in-memory cache (cache-aside), Front Door/CDN caching of redirects; \`301\` (cached by browsers, fewer hits, worse analytics) vs \`302\` (every click hits you).

**Analytics**: don't write to SQL synchronously per click — publish to Event Hubs / a queue, aggregate in batches.

**Other**: rate limiting on creation, malicious URL scanning, expiry cleanup, Minimal API for the hot path.`,
  },
  {
    id: 'sd-rate-limiter-dotnet',
    category: 'System Design (.NET)',
    difficulty: 3,
    question: 'How would you design a rate limiter for a public API?',
    tldr: 'Choose the key (API key / user / IP) and an algorithm (token bucket for bursts, sliding window for accuracy); for one instance use ASP.NET Core’s built-in RateLimiter middleware, for many instances keep counters in Redis (atomic Lua script) or at the gateway (APIM / Front Door), and return 429 with Retry-After.',
    answer: `**Algorithms**
- **Fixed window**: count per minute; simple, but allows 2× bursts at window edges.
- **Sliding window** (log or counter approximation): smoother, more accurate.
- **Token bucket**: tokens refill at rate r, bucket size b allows short bursts — most common for APIs.
- **Concurrency limiter**: max N requests in flight.

**ASP.NET Core (.NET 7+)**
\`\`\`csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("per-client", ctx => RateLimitPartition.GetTokenBucketLimiter(
        partitionKey: ctx.User.FindFirst("client_id")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        factory: _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 100, TokensPerPeriod = 50, ReplenishmentPeriod = TimeSpan.FromSeconds(10), QueueLimit = 0
        }));
});
app.UseRateLimiter();
app.MapGet("/api/data", GetData).RequireRateLimiting("per-client");
\`\`\`
It is **in-memory per instance** → with 4 instances the effective limit is ~4×.

**Distributed**
- **Redis** counters with an atomic Lua script (INCR + EXPIRE, or token bucket state), keyed by client + window.
- Or at the edge: **Azure API Management** (\`rate-limit-by-key\`, quotas per subscription), Front Door WAF rate limit rules.
- Fail-open vs fail-closed if Redis is down — a business decision.

**API behaviour**: \`429 Too Many Requests\` + \`Retry-After\`, \`X-RateLimit-Limit/Remaining/Reset\` headers, different tiers per plan, documentation; clients retry with backoff and jitter.`,
  },

  // =====================================================================
  // LIVE CODING & CODE REVIEW
  // =====================================================================
  {
    id: 'lc-code-review-checklist',
    category: 'Live Coding & Code Review',
    difficulty: 2,
    question: 'Do a code review of this code: what would you fix and why?\n\npublic async void ProcessOrders(int customerId) {\n  var conn = new SqlConnection(_cs);\n  conn.Open();\n  var cmd = new SqlCommand("SELECT * FROM Orders WHERE CustomerId = " + customerId, conn);\n  var reader = cmd.ExecuteReader();\n  while (reader.Read()) {\n    var client = new HttpClient();\n    var res = client.GetAsync("https://api/x/" + reader["Id"]).Result;\n    if (res.StatusCode == 200) total += 0.23 * (decimal)reader["Amount"];\n  }\n  try { _repo.Save(total); } catch (Exception) { }\n}',
    tldr: 'Talk through it by severity: async void, .Result (deadlock/thread blocking), SQL by concatenation (injection), missing using/dispose, new HttpClient per call (socket exhaustion), N+1 HTTP calls in a loop, swallowed exception, magic number, shared mutable field, SELECT *, no cancellation, mixed responsibilities.',
    answer: `**How to run a code review in the interview**: first ask what the code should do and its context, then go **from most severe to cosmetic**, explain *why* each is a problem, and propose the fix. Think out loud.

**Correctness / reliability**
- \`async void\`: caller can't await it, exceptions crash the process → \`async Task\`.
- \`.Result\` on \`GetAsync\`: blocks a thread, risk of deadlock with a SynchronizationContext → \`await\`.
- \`catch (Exception) { }\` swallows the failure; the caller thinks it worked → log and rethrow / handle a specific exception.
- \`total\` is a **field** mutated by a method → state leaks between calls, not thread-safe → local variable, return a result.
- Status check \`== 200\` → \`res.IsSuccessStatusCode\` / \`EnsureSuccessStatusCode\`; what about failures — retry?

**Security**
- **SQL injection** via concatenation (even with an int today — the pattern is the problem) → parameters / EF Core.

**Resources / performance**
- \`SqlConnection\`, \`SqlCommand\`, \`SqlDataReader\` not disposed → \`await using\`; connection pool exhaustion.
- \`new HttpClient()\` per iteration → **socket exhaustion** → \`IHttpClientFactory\` / typed client.
- HTTP call per row = **N+1** over the network, sequential → batch endpoint, or bounded parallelism (\`Parallel.ForEachAsync\` with MaxDegreeOfParallelism).
- \`SELECT *\` → only needed columns; sync DB calls → async; no \`CancellationToken\`.

**Design / readability**
- Magic number \`0.23\` → named constant / configuration (\`VatRate\`), and \`decimal\` literal \`0.23m\` (this line wouldn't even compile: double * decimal).
- Hard-coded URL → configuration / typed client base address.
- One method does data access, HTTP, business calculation and persistence → **SRP**: repository, client, calculator; testable via DI.

\`\`\`csharp
public async Task<decimal> CalculateCustomerTotalAsync(int customerId, CancellationToken ct)
{
    var orders = await _db.Orders.Where(o => o.CustomerId == customerId)
        .Select(o => new { o.Id, o.Amount }).ToListAsync(ct);
    var approved = await _approvalClient.GetApprovedAsync(orders.Select(o => o.Id), ct);   // one batched call
    var total = orders.Where(o => approved.Contains(o.Id)).Sum(o => o.Amount * _options.VatRate);
    await _repo.SaveTotalAsync(customerId, total, ct);
    return total;
}
\`\`\``,
  },
  {
    id: 'lc-paged-filtered-endpoint',
    category: 'Live Coding & Code Review',
    difficulty: 2,
    question: 'Write an endpoint that returns a paginated, filtered list.',
    tldr: 'Validate and clamp page/pageSize, build the IQueryable conditionally (filters before paging), apply a deterministic ORDER BY, project to a DTO with AsNoTracking, return items + total count (or use keyset pagination for deep pages).',
    answer: `\`\`\`csharp
public record OrderQuery(string? Status, DateOnly? From, string? Search, int Page = 1, int PageSize = 20);
public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

app.MapGet("/orders", async ([AsParameters] OrderQuery q, AppDbContext db, CancellationToken ct) =>
{
    var page = Math.Max(1, q.Page);
    var size = Math.Clamp(q.PageSize, 1, 100);                 // never let the client ask for 1M rows

    var query = db.Orders.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(o => o.Status == q.Status);
    if (q.From is not null) query = query.Where(o => o.CreatedOn >= q.From);
    if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(o => o.Customer.Name.Contains(q.Search));

    var total = await query.CountAsync(ct);
    var items = await query
        .OrderByDescending(o => o.CreatedOn).ThenBy(o => o.Id)  // deterministic order for stable pages
        .Skip((page - 1) * size).Take(size)
        .Select(o => new OrderListItem(o.Id, o.Customer.Name, o.Total, o.Status))
        .ToListAsync(ct);

    return Results.Ok(new PagedResult<OrderListItem>(items, page, size, total));
})
.RequireAuthorization();
\`\`\`

**Talking points**
- Filtering and paging happen **in SQL** (IQueryable), not after \`ToList()\`.
- Stable ordering is required, otherwise rows jump between pages.
- **Offset pagination** gets slow for deep pages (the DB still reads skipped rows) → **keyset/cursor pagination**: \`WHERE (CreatedOn, Id) < (@lastDate, @lastId)\` + \`Take(size)\`, return a \`nextCursor\`.
- \`COUNT\` on huge tables can be expensive → optional total, or approximate.
- Indexes matching filters + sort; authorization scoping (only the user's orders); validation (FluentValidation) returning 400 ProblemDetails.
- Then: "how would you test it?" → integration test with WebApplicationFactory + seeded data.`,
  },
  {
    id: 'lc-linq-groupby-stats',
    category: 'Live Coding & Code Review',
    difficulty: 2,
    question: 'Group data with LINQ and compute statistics (e.g. order totals per customer). Show GroupBy, Join, SelectMany, Aggregate.',
    tldr: 'GroupBy by key then project Sum/Count/Average/Max per group; Join to bring in names; SelectMany to flatten nested collections; Aggregate for a custom fold — and know which of these EF Core can translate to SQL.',
    answer: `\`\`\`csharp
record Customer(int Id, string Name);
record Order(int Id, int CustomerId, decimal Total, DateTime Date, List<OrderLine> Lines);
record OrderLine(string Product, int Qty, decimal Price);

// totals per customer, top 5 by revenue
var stats = orders
    .GroupBy(o => o.CustomerId)
    .Select(g => new
    {
        CustomerId = g.Key,
        Count = g.Count(),
        Revenue = g.Sum(o => o.Total),
        Average = g.Average(o => o.Total),
        LastOrder = g.Max(o => o.Date)
    })
    .Join(customers, s => s.CustomerId, c => c.Id, (s, c) => new { c.Name, s.Count, s.Revenue, s.Average, s.LastOrder })
    .OrderByDescending(x => x.Revenue)
    .Take(5)
    .ToList();

// SelectMany: flatten order lines → best-selling products
var topProducts = orders
    .SelectMany(o => o.Lines)
    .GroupBy(l => l.Product)
    .Select(g => new { Product = g.Key, Qty = g.Sum(l => l.Qty) })
    .OrderByDescending(x => x.Qty);

// Aggregate: custom fold (e.g. min and max in one pass)
var (min, max) = orders.Aggregate((min: decimal.MaxValue, max: decimal.MinValue),
    (acc, o) => (Math.Min(acc.min, o.Total), Math.Max(acc.max, o.Total)));

// lookups instead of nested loops: O(n) instead of O(n*m)
var byCustomer = orders.ToLookup(o => o.CustomerId);
var dict = customers.ToDictionary(c => c.Id);
\`\`\`

**Talking points**
- Complexity: \`Join\`, \`GroupBy\`, \`ToDictionary\`, \`ToLookup\` use hashing → O(n + m); a \`Where\` inside a \`foreach\` is O(n·m).
- **Deferred execution**: the query runs when enumerated; enumerate once (\`ToList\`) if you reuse it.
- **EF Core**: GroupBy with aggregates translates to SQL \`GROUP BY\`; \`Aggregate\` and arbitrary C# methods don't → do them after materialising, or rethink.
- .NET 9 additions: \`CountBy\`, \`AggregateBy\`, \`Index\`.`,
  },
  {
    id: 'lc-find-async-bug',
    category: 'Live Coding & Code Review',
    difficulty: 3,
    question: 'Find the bugs in this async code:\n\npublic async Task<List<User>> LoadAsync(List<int> ids) {\n  var result = new List<User>();\n  ids.ForEach(async id => {\n    var u = await _client.GetUserAsync(id);\n    result.Add(u);\n  });\n  return result;\n}',
    tldr: 'List.ForEach with an async lambda creates async void delegates: nothing is awaited, so the method returns an (often empty) list, exceptions are lost/crash the process, and List.Add is called concurrently without synchronisation. Use Task.WhenAll (with bounded concurrency) and collect the results.',
    answer: `**What's wrong**
1. \`ForEach(Action<T>)\` + \`async\` lambda = **async void**. \`ForEach\` doesn't wait; the method returns immediately with a partially filled (usually empty) list.
2. Exceptions inside async void go to the SynchronizationContext / thread pool → **unobserved crash**, can't be caught by the caller.
3. Continuations run concurrently on thread-pool threads → \`List<T>.Add\` is **not thread-safe** → lost items or exceptions.
4. No \`CancellationToken\`, unbounded parallelism (1,000 ids → 1,000 simultaneous HTTP calls).

**Fix**
\`\`\`csharp
public async Task<IReadOnlyList<User>> LoadAsync(IEnumerable<int> ids, CancellationToken ct)
{
    var tasks = ids.Select(id => _client.GetUserAsync(id, ct));
    return await Task.WhenAll(tasks);          // results in order, exceptions propagate
}

// bounded concurrency for many ids
public async Task<IReadOnlyList<User>> LoadManyAsync(IEnumerable<int> ids, CancellationToken ct)
{
    var bag = new ConcurrentBag<User>();
    await Parallel.ForEachAsync(ids, new ParallelOptions { MaxDegreeOfParallelism = 8, CancellationToken = ct },
        async (id, token) => bag.Add(await _client.GetUserAsync(id, token)));
    return bag.ToList();
}
\`\`\`
Even better: a **batch endpoint** (\`GET /users?ids=1,2,3\`) to avoid N calls.

**Other classic async bugs to look for**: \`.Result\`/\`.Wait()\`, missing \`await\` (fire-and-forget), \`async\` in \`lock\`, \`Task.Run\` wrapping I/O in ASP.NET, not passing the CancellationToken, \`DbContext\` used concurrently from several tasks (not thread-safe!).`,
  },
  {
    id: 'lc-refactor-god-class',
    category: 'Live Coding & Code Review',
    difficulty: 2,
    question: 'Refactor a class that does too much. How do you approach it?',
    tldr: 'First secure behaviour with tests (characterisation tests), then identify responsibilities and reasons to change, extract them step by step (methods → classes behind interfaces injected via DI), remove duplication and magic values, and keep every step small and green.',
    answer: `**Process (say it out loud)**
1. **Understand & protect**: what does it do, who calls it? Write **characterisation tests** around the public behaviour before changing anything.
2. **Find responsibilities**: list what the class knows/does — validation, data access, business rules, formatting, notifications, logging. Each = a reason to change (SRP).
3. **Small safe steps** (IDE refactorings):
   - Extract Method for long blocks, give names to concepts.
   - Replace magic numbers/strings with constants or options.
   - Extract Class / interface: \`IOrderRepository\`, \`IPriceCalculator\`, \`INotificationSender\`.
   - Inject dependencies via the constructor instead of \`new\` / static calls.
   - Replace conditionals by type with **Strategy** / polymorphism when the switch keeps growing.
   - Remove duplication only when it's the same knowledge (DRY), not accidental similarity.
4. Run tests after every step; commit often.
5. Stop when it's good enough — don't build a framework.

\`\`\`csharp
// before: OrderService.Process() validates, calculates, saves, e-mails, logs (300 lines)
// after:
public class PlaceOrderHandler(IValidator<PlaceOrder> validator, IPriceCalculator prices,
                               IOrderRepository orders, IPublisher publisher)
{
    public async Task<Guid> Handle(PlaceOrder cmd, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(cmd, ct);
        var order = Order.Create(cmd.CustomerId, prices.Calculate(cmd.Lines));
        await orders.AddAsync(order, ct);
        await publisher.Publish(new OrderPlaced(order.Id), ct);   // e-mail handled by a subscriber
        return order.Id;
    }
}
\`\`\`
**Then**: write a unit test for the new calculator to show the gain in testability.`,
  },
  {
    id: 'lc-cache-rate-limiter-impl',
    category: 'Live Coding & Code Review',
    difficulty: 3,
    question: 'Implement a simple thread-safe cache with expiration (or a simple rate limiter).',
    tldr: 'Use ConcurrentDictionary with entries holding value + expiry, and Lazy<Task<T>> so concurrent misses for the same key trigger only one load; for a rate limiter, a per-key fixed/sliding window or token bucket guarded by a lock — then discuss eviction, memory limits and why IMemoryCache/HybridCache exist.',
    answer: `**Cache (get-or-add with TTL, single load per key)**
\`\`\`csharp
public sealed class SimpleCache<TKey, TValue>(TimeProvider time, TimeSpan ttl) where TKey : notnull
{
    private sealed record Entry(Lazy<Task<TValue>> Value, DateTimeOffset ExpiresAt);
    private readonly ConcurrentDictionary<TKey, Entry> _items = new();

    public Task<TValue> GetOrAddAsync(TKey key, Func<TKey, Task<TValue>> factory)
    {
        var now = time.GetUtcNow();
        var entry = _items.AddOrUpdate(key,
            k => New(k),
            (k, existing) => existing.ExpiresAt > now ? existing : New(k));
        return entry.Value.Value;

        Entry New(TKey k) => new(new Lazy<Task<TValue>>(() => factory(k)), now + ttl);
    }

    public void Remove(TKey key) => _items.TryRemove(key, out _);
}
\`\`\`
- \`Lazy<Task<T>>\` prevents a **cache stampede**: many concurrent requests for the same key share one load.
- Discuss: failed loads should not be cached (remove on exception), unbounded growth → max size / LRU eviction / periodic cleanup, \`TimeProvider\` for testability.
- In production: \`IMemoryCache\` (SizeLimit, eviction) or \`HybridCache\` (.NET 9, stampede protection + L2 Redis).

**Rate limiter (fixed window per key)**
\`\`\`csharp
public sealed class FixedWindowLimiter(int limit, TimeSpan window, TimeProvider time)
{
    private readonly ConcurrentDictionary<string, (DateTimeOffset Start, int Count)> _windows = new();
    private readonly object _gate = new();

    public bool TryAcquire(string key)
    {
        lock (_gate)                                  // simple and correct; shard locks if it gets hot
        {
            var now = time.GetUtcNow();
            var w = _windows.GetValueOrDefault(key);
            if (now - w.Start >= window) w = (now, 0);
            if (w.Count >= limit) return false;
            _windows[key] = (w.Start, w.Count + 1);
            return true;
        }
    }
}
\`\`\`
Then mention: fixed window allows bursts at the edges → sliding window or **token bucket**; for many instances → Redis; and ASP.NET Core already has \`System.Threading.RateLimiting\`. Write a test with \`FakeTimeProvider\`.`,
  },
  {
    id: 'lc-big-o-collections',
    category: 'Live Coding & Code Review',
    difficulty: 1,
    question: 'Big O of common .NET collections: List vs Dictionary vs HashSet. Solve: find duplicates, palindrome, two-sum.',
    tldr: 'List: index O(1), Contains/Remove O(n); Dictionary/HashSet: lookup/insert O(1) average via hashing. Most live-coding tasks become O(n) by trading memory for a HashSet/Dictionary instead of nested loops.',
    answer: `| Operation | List<T> | Dictionary / HashSet | SortedDictionary |
|---|---|---|---|
| index access | O(1) | — | — |
| Contains / lookup | O(n) | O(1) avg | O(log n) |
| Add | O(1) amortised | O(1) avg | O(log n) |
| Remove | O(n) | O(1) avg | O(log n) |

\`\`\`csharp
// duplicates: O(n)
static IEnumerable<int> Duplicates(IEnumerable<int> xs)
{
    var seen = new HashSet<int>();
    var dups = new HashSet<int>();
    foreach (var x in xs) if (!seen.Add(x)) dups.Add(x);
    return dups;
}

// palindrome with two pointers, ignoring case and non-letters: O(n), O(1) memory
static bool IsPalindrome(string s)
{
    int i = 0, j = s.Length - 1;
    while (i < j)
    {
        if (!char.IsLetterOrDigit(s[i])) { i++; continue; }
        if (!char.IsLetterOrDigit(s[j])) { j--; continue; }
        if (char.ToLowerInvariant(s[i++]) != char.ToLowerInvariant(s[j--])) return false;
    }
    return true;
}

// two-sum: indices of two numbers adding up to target: O(n)
static (int, int)? TwoSum(int[] nums, int target)
{
    var index = new Dictionary<int, int>();
    for (int i = 0; i < nums.Length; i++)
    {
        if (index.TryGetValue(target - nums[i], out var j)) return (j, i);
        index[nums[i]] = i;
    }
    return null;
}

// reverse a string
static string Reverse(string s) { var a = s.ToCharArray(); Array.Reverse(a); return new string(a); }
\`\`\`

**Interview habits**: clarify input (nulls, empty, size, case sensitivity), state the brute force and its complexity, then optimise, write a few test cases (including edge cases), say the final time/space complexity.`,
  },

  // =====================================================================
  // AI AT WORK
  // =====================================================================
  {
    id: 'ai-daily-use',
    category: 'AI at Work',
    difficulty: 1,
    question: 'How do you use AI in your daily work?',
    tldr: 'Concrete and balanced: Copilot/agents for boilerplate, tests, refactoring and exploring unfamiliar code; plan/ask/agent modes depending on the task; custom instructions/skills and MCP (e.g. Figma) for context — while you stay responsible for design decisions and reviewing every change.',
    answer: `**Structure your answer around real use cases** (fill in your own):
- **Ask mode**: explaining unfamiliar code or a library, comparing approaches, drafting SQL / KQL / regex, reading error messages and stack traces.
- **Plan mode**: before a bigger change — let the assistant propose a plan, then I review and correct it before any code is written.
- **Agent mode**: well-specified, verifiable tasks — boilerplate (DTOs, mappings, endpoints), unit tests for existing code, mechanical refactors across files, migrations of APIs; always on a branch, reviewed like a junior's PR.
- **Context**: repository instructions / custom skills (coding conventions, architecture rules), **MCP servers** (e.g. Figma MCP to turn a design into Angular components, docs, issue tracker).
- **Where I don't use it blindly**: security-sensitive code (auth, crypto), architectural decisions, anything I can't verify.

**Impact**: [e.g. faster test writing, quicker onboarding into legacy code, prototype in hours instead of days] — use a concrete example.

**Tone**: enthusiastic but critical — companies look for people who use AI effectively *and* safely.`,
  },
  {
    id: 'ai-verify-code',
    category: 'AI at Work',
    difficulty: 2,
    question: 'How do you verify AI-generated code?',
    tldr: 'Treat it like code from a new teammate: read and understand every line, run it, cover it with tests (ideally tests I wrote or checked), check edge cases, security, performance and conventions, verify APIs and package names actually exist, and keep the change small enough to review.',
    answer: `- **Understand it**: if I can't explain it, it doesn't go in. Ask the assistant to explain parts, but verify against docs.
- **Tests**: run existing tests; add tests for new behaviour and edge cases (nulls, empty, concurrency, time zones). Be careful when the AI writes both code and tests — they can share the same wrong assumption; check that a test fails when the code is broken.
- **Hallucinations**: non-existent methods, wrong overloads, outdated APIs (e.g. old Azure SDK), made-up NuGet/npm packages (also a **supply-chain risk** — typosquatting).
- **Security review**: injection, missing authorization checks, secrets in code, over-permissive CORS, unsafe deserialisation, logging PII.
- **Performance and correctness**: N+1 queries, sync-over-async, missing cancellation, unbounded loops/collections.
- **Fit**: matches our architecture and conventions, no unnecessary abstractions or dependencies.
- **Process**: small diffs, normal PR review, CI with analyzers and tests — AI-written code gets no shortcut.`,
  },
  {
    id: 'ai-risks',
    category: 'AI at Work',
    difficulty: 2,
    question: 'What risks do you see in using AI in a project (security, client data, quality)?',
    tldr: 'Data leakage (client code, secrets, personal data sent to unapproved tools), licensing/IP, insecure or subtly wrong code, hallucinated dependencies, over-reliance and skill erosion, and prompt injection when agents read untrusted content — mitigated with approved enterprise tools, policies, reviews and tests.',
    answer: `**Data & compliance**
- Client source code, credentials or personal data pasted into tools without an enterprise agreement → contract / GDPR breach. Use **approved tools** (enterprise plans with no training on your data, data residency), follow the client's policy, never paste secrets or production data.

**Quality & security**
- Plausible but wrong code, insecure defaults, outdated patterns; vulnerabilities at scale because review gets lazy.
- **Hallucinated packages** → attackers register those names (slopsquatting).
- **Prompt injection**: an agent reading issues, web pages or documents can be manipulated into running commands or leaking data → least-privilege tokens, sandboxes, human approval for actions.

**Legal**: licence of generated code / snippets, IP ownership — check the company policy.

**Team**: over-reliance, juniors not learning fundamentals, huge AI-generated PRs that nobody can review properly, inconsistent style.

**Mitigations**: written AI usage policy, approved tools, code review and tests as non-negotiable, secret scanning, dependency scanning, small PRs, sharing good prompts/skills in the team, measuring the real impact.`,
  },
]);
