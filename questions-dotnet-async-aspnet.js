/*
  .NET TRACK: ASYNC & CONCURRENCY, ASP.NET CORE
  Format: see the comment at the top of questions.js
*/
addQuestions('dotnet', [
  // =====================================================================
  // ASYNC & CONCURRENCY (.NET)
  // =====================================================================
  {
    id: 'async-await-under-hood',
    category: 'Async & Concurrency (.NET)',
    difficulty: 3,
    question: 'What happens when code reaches await? Does async create a new thread?',
    tldr: 'No new thread: the compiler turns the method into a state machine; at an await on an incomplete task it registers a continuation and returns to the caller, freeing the thread. When the I/O completes, the continuation resumes on the captured SynchronizationContext or a thread-pool thread.',
    answer: `**The compiler rewrites an async method into a state machine** (a struct implementing \`IAsyncStateMachine\`). Local variables become fields; each \`await\` is a numbered state.

**At \`await someTask\`**
1. Call \`GetAwaiter()\` and check \`IsCompleted\`.
2. **Already completed** (e.g. cached data) → continue **synchronously**, no thread switch at all.
3. **Not completed** → save state, register a **continuation** (\`OnCompleted\`), and **return** an incomplete \`Task\` to the caller. The current thread is free to do other work (in ASP.NET Core: serve other requests).
4. When the operation completes, the continuation is scheduled:
   - on the captured **SynchronizationContext** if there is one (UI thread in WPF/WinForms, old ASP.NET request context),
   - otherwise on a **thread-pool** thread (ASP.NET Core, console apps).
5. The state machine resumes after the \`await\`, possibly on a **different thread**.

**Where is the thread during I/O?** Nowhere — there is no thread waiting. The OS handles the I/O (IOCP on Windows, epoll on Linux) and signals completion. That's why async I/O scales: 10,000 concurrent HTTP calls don't need 10,000 threads.

\`\`\`csharp
public async Task<Order> GetOrderAsync(int id, CancellationToken ct)
{
    var order = await _db.Orders.FindAsync([id], ct);  // thread released while SQL Server works
    order.Customer = await _crm.GetCustomerAsync(order.CustomerId, ct);  // released again
    return order;                                        // completes the returned Task
}
\`\`\`

**async ≠ parallel ≠ background thread**
- \`async\` alone just allows awaiting; it doesn't start anything on another thread.
- \`Task.Run\` **does** queue work to the thread pool — use it for CPU-bound work in UI/desktop apps, not to "make I/O async" in ASP.NET Core.
- CPU-bound code inside an async method runs synchronously on the current thread until the first incomplete await.

**Exceptions** are captured into the returned Task and rethrown at the \`await\` with their original stack trace.`,
    followUps: [
      { q: 'Is there any overhead to async?', a: 'Yes, small: the state machine, possibly a Task allocation and continuation scheduling. For hot paths that usually complete synchronously, ValueTask or caching completed tasks reduce allocations. For I/O the scalability benefit far outweighs it.' },
    ],
  },
  {
    id: 'async-result-deadlock',
    category: 'Async & Concurrency (.NET)',
    difficulty: 3,
    question: 'Why can .Result or .Wait() deadlock an application? How do you avoid it?',
    tldr: 'Blocking on a task while holding a single-threaded SynchronizationContext (UI, classic ASP.NET) deadlocks: the continuation needs that context, which is blocked waiting for it. In ASP.NET Core there is no context, but sync-over-async still causes thread-pool starvation. Use async all the way.',
    answer: `**The classic deadlock** (WPF/WinForms or ASP.NET on .NET Framework)
\`\`\`csharp
// UI button click (has a SynchronizationContext)
private void Button_Click(object s, EventArgs e)
{
    var data = LoadAsync().Result;      // 1. UI thread blocks, waiting for the task
}
private async Task<string> LoadAsync()
{
    var json = await _http.GetStringAsync(url);   // 2. continuation wants to resume on the UI thread
    return json;                                  // 3. ...which is blocked in step 1 → deadlock
}
\`\`\`
The continuation is posted to the captured context, but that context's only thread is stuck in \`.Result\`. Neither can proceed.

**ASP.NET Core**: there is **no SynchronizationContext**, so this exact deadlock doesn't happen — but blocking is still harmful:
- \`.Result\` / \`.Wait()\` / \`GetAwaiter().GetResult()\` block a thread-pool thread for the whole I/O duration.
- Under load, all pool threads end up blocked waiting → new requests queue → **thread-pool starvation**: latency explodes, timeouts, health checks fail, even though CPU is low.

**How to avoid**
- **Async all the way**: make the caller async and \`await\` (\`async Task\` up to the controller / handler / \`Main\`).
- Library code: \`ConfigureAwait(false)\` so it doesn't capture a context (protects callers that do block).
- No async API available and you're forced to block (e.g. inside a legacy synchronous interface)? Last resort: \`Task.Run(() => DoAsync()).GetAwaiter().GetResult()\` — still blocks a thread, but avoids the context deadlock. Better: change the interface.
- Constructors can't be async → use a factory method (\`static async Task<T> CreateAsync()\`) or lazy async initialisation.
- Prefer \`GetAwaiter().GetResult()\` over \`.Result\` if you must block — it throws the original exception instead of \`AggregateException\`.

**Diagnosing starvation**: \`dotnet-counters\` (ThreadPool Queue Length, Thread Count rising slowly), \`dotnet-dump\` with \`clrstack\` showing many threads in \`Task.Wait\`.`,
  },
  {
    id: 'async-configureawait',
    category: 'Async & Concurrency (.NET)',
    difficulty: 2,
    question: 'What does ConfigureAwait(false) do, and does it still matter in ASP.NET Core?',
    tldr: 'It tells the awaiter not to resume on the captured SynchronizationContext/TaskScheduler but on any thread-pool thread. ASP.NET Core has no SynchronizationContext, so in app code it changes nothing; in reusable libraries you should still use it because they may run in UI or legacy contexts.',
    answer: `**What it does**: by default \`await\` captures the current \`SynchronizationContext\` (or non-default \`TaskScheduler\`) and posts the continuation back to it. \`ConfigureAwait(false)\` says "I don't need that — continue wherever".

\`\`\`csharp
// library code
public async Task<Report> BuildReportAsync(CancellationToken ct)
{
    var raw = await _client.GetDataAsync(ct).ConfigureAwait(false);   // don't capture the context
    return Parse(raw);                                                // may run on a pool thread
}
\`\`\`

**Benefits where a context exists (WPF, WinForms, MAUI, classic ASP.NET)**
- Avoids the \`.Result\` deadlock if some caller blocks.
- Better performance: no marshalling back to the UI thread for work that doesn't touch the UI.

**ASP.NET Core**
- No \`SynchronizationContext\` → continuations already run on the thread pool, so \`ConfigureAwait(false)\` in **application code** (controllers, handlers, services) has practically no effect. Most teams skip it there for readability.
- \`HttpContext\` is not tied to a thread anyway (but it's not thread-safe — don't use it from parallel tasks).

**Libraries / NuGet packages / shared code**: **still use it** on every await — you don't know where the code will run. Analyzers (CA2007, ConfigureAwaitChecker) can enforce it.

**Don't use it when** code after the await needs the context: updating UI controls, or relying on context-flowing state in legacy ASP.NET (\`HttpContext.Current\`).

**.NET 8+**: \`ConfigureAwaitOptions\` (\`await task.ConfigureAwait(ConfigureAwaitOptions.SuppressThrowing)\`, \`ForceYielding\`) for advanced scenarios.

Note: \`AsyncLocal<T>\` / \`ExecutionContext\` (e.g. Activity for tracing, culture) **still flow** with ConfigureAwait(false) — it only affects the synchronization context.`,
  },
  {
    id: 'async-task-vs-valuetask',
    category: 'Async & Concurrency (.NET)',
    difficulty: 3,
    question: 'What is the difference between Task and ValueTask?',
    tldr: 'Task is a class (heap allocation) that can be awaited many times and combined freely; ValueTask is a struct that avoids the allocation when the result is often available synchronously, but must be awaited exactly once. Default to Task; use ValueTask for hot paths that usually complete synchronously.',
    answer: `**Task / Task<T>**
- Reference type → an allocation per call (except cached completed tasks like \`Task.CompletedTask\` or small cached results).
- Can be awaited **multiple times**, stored, passed to \`WhenAll\`/\`WhenAny\`, \`.Result\` after completion is safe.

**ValueTask / ValueTask<T>**
- A struct wrapping either a **result** (completed synchronously — no allocation) or a \`Task\` / \`IValueTaskSource\` (pooled, reusable).
- Pays off in **hot paths where the result is usually already available**: cache hits, buffered streams, channel reads.

\`\`\`csharp
private readonly ConcurrentDictionary<int, Product> _cache = new();

public ValueTask<Product> GetProductAsync(int id, CancellationToken ct)
{
    if (_cache.TryGetValue(id, out var cached))
        return ValueTask.FromResult(cached);            // no allocation on cache hit
    return new ValueTask<Product>(LoadAndCacheAsync(id, ct));
}
\`\`\`

**Rules for consuming a ValueTask** (it may wrap a pooled object that gets reused):
- Await it **exactly once**. Never await twice, never await concurrently.
- Don't call \`.Result\` / \`.GetAwaiter().GetResult()\` unless it's already completed.
- Need to store it or use it in \`WhenAll\`? Convert with \`.AsTask()\` (once).

\`\`\`csharp
var vt = GetProductAsync(1, ct);
var p1 = await vt;
var p2 = await vt;     // ✘ undefined behaviour with pooled sources
\`\`\`

**Guidance**
- Default to **Task** in application code and public APIs — simpler and safer.
- Use **ValueTask** when profiling shows allocation pressure in a method called very frequently that often completes synchronously, or when implementing interfaces that already use it (\`IAsyncDisposable.DisposeAsync\`, \`IAsyncEnumerator.MoveNextAsync\`, \`Stream.ReadAsync(Memory<byte>)\`).
- A ValueTask wrapping an actual async operation has no benefit over Task (slightly bigger struct).`,
  },
  {
    id: 'async-void',
    category: 'Async & Concurrency (.NET)',
    difficulty: 2,
    question: 'Why is async void dangerous?',
    tldr: 'An async void method cannot be awaited, so callers don\'t know when it finishes and cannot catch its exceptions; an unhandled exception is raised on the SynchronizationContext or thread pool and can crash the process. Use it only for event handlers.',
    answer: `**Problems**
1. **Exceptions can't be caught by the caller.** With \`async Task\` the exception is stored in the task. With \`async void\` there is no task — the exception is rethrown on the captured SynchronizationContext or the **thread pool**, where it's unhandled → in ASP.NET Core / console / worker services **the process crashes**.
2. **Can't be awaited**: callers continue immediately; you can't know when it completes, can't sequence work, can't use \`WhenAll\`.
3. **Hard to test**: the test finishes before the method does.
4. In ASP.NET Core: work continues **after the request ended**, using disposed scoped services (\`DbContext\` → \`ObjectDisposedException\`).

\`\`\`csharp
// ✘ fire-and-forget bug
public async void SendWelcomeEmail(User u)
{
    await _mailer.SendAsync(u.Email);     // if it throws → unhandled → app crash
}

public IActionResult Register(User u)
{
    try { SendWelcomeEmail(u); }          // this try/catch catches NOTHING from the email
    catch (Exception) { }
    return Ok();
}

// ✔ return Task and await it
public async Task SendWelcomeEmailAsync(User u, CancellationToken ct) => await _mailer.SendAsync(u.Email, ct);
\`\`\`

**The legitimate use**: **event handlers**, whose signature must return void (WinForms/WPF \`Button_Click\`, \`EventHandler\`). Even then, wrap the body in try/catch and log.
\`\`\`csharp
private async void SaveButton_Click(object sender, EventArgs e)
{
    try { await SaveAsync(); }
    catch (Exception ex) { _logger.LogError(ex, "Save failed"); ShowError(); }
}
\`\`\`

**Real fire-and-forget in ASP.NET Core**: don't. Use a background queue (\`Channel<T>\` + \`BackgroundService\`), a message broker, or a job framework (Hangfire), so work survives the request, gets its own DI scope, retries and logging.

Watch out for lambdas: \`list.ForEach(async x => await ...)\` creates **async void** lambdas — use \`foreach\` with \`await\` or \`Task.WhenAll\`.`,
  },
  {
    id: 'async-throttle-100-http',
    category: 'Async & Concurrency (.NET)',
    difficulty: 3,
    question: 'You need to make 100 HTTP calls. How do you parallelise them without overloading the server?',
    tldr: 'Run them concurrently but with a cap: Parallel.ForEachAsync with MaxDegreeOfParallelism, or Task.WhenAll with a SemaphoreSlim gate, using IHttpClientFactory, passing a CancellationToken, and handling retries and partial failures.',
    answer: `**Option 1 — \`Parallel.ForEachAsync\`** (.NET 6+): simplest.
\`\`\`csharp
var results = new ConcurrentBag<PriceResult>();

await Parallel.ForEachAsync(productIds,
    new ParallelOptions { MaxDegreeOfParallelism = 10, CancellationToken = ct },
    async (id, token) =>
    {
        var price = await _client.GetFromJsonAsync<PriceResult>($"prices/{id}", token);
        results.Add(price!);
    });
\`\`\`

**Option 2 — \`Task.WhenAll\` + \`SemaphoreSlim\`**: keeps results in order and gives full control.
\`\`\`csharp
using var gate = new SemaphoreSlim(10);           // at most 10 in flight

var tasks = productIds.Select(async id =>
{
    await gate.WaitAsync(ct);
    try
    {
        return await _client.GetFromJsonAsync<PriceResult>($"prices/{id}", ct);
    }
    finally
    {
        gate.Release();
    }
});

PriceResult?[] prices = await Task.WhenAll(tasks);   // results in input order
\`\`\`

**Why not plain \`Task.WhenAll\` on all 100 (or 10,000)?** Every request starts at once: you can overload the target API (429/503), exhaust connections, and spike memory. Why not \`Parallel.ForEach\` (sync)? It blocks thread-pool threads for I/O.

**Details a senior mentions**
- **HttpClient**: a typed client via \`IHttpClientFactory\` (connection pooling, DNS refresh) — never \`new HttpClient()\` per call. Also mind \`MaxConnectionsPerServer\` on the handler.
- **Choose the limit** from the server's documented rate limit or by measurement; respect \`429 Retry-After\`.
- **Resilience**: \`AddStandardResilienceHandler()\` (retry with backoff + jitter, circuit breaker, timeouts) from \`Microsoft.Extensions.Http.Resilience\`.
- **Partial failures**: \`WhenAll\` throws the first exception on await — decide whether one failure should fail everything or collect per-item results (try/catch inside the lambda returning a result object).
- **Cancellation**: pass the token everywhere; cancel the rest if one fails when results are useless without it.
- Is there a **batch endpoint**? One call with 100 IDs beats 100 calls.
- For a continuous stream of work: \`Channel<T>\` with N consumers.`,
  },
  {
    id: 'async-cancellation-token',
    category: 'Async & Concurrency (.NET)',
    difficulty: 2,
    question: 'How does CancellationToken work and where do you pass it?',
    tldr: 'It is cooperative cancellation: a CancellationTokenSource signals, and code that receives the token checks it or passes it down to async APIs, which throw OperationCanceledException. Accept it in every async method and pass it all the way to I/O (EF Core, HttpClient, streams).',
    answer: `**Mechanics**
- \`CancellationTokenSource\` (CTS) owns the signal: \`Cancel()\`, \`CancelAfter(TimeSpan)\`.
- \`CancellationToken\` is a lightweight struct handed to consumers; it can only **observe**.
- Cancellation is **cooperative**: nothing is aborted forcibly. Code must check \`token.IsCancellationRequested\` / call \`token.ThrowIfCancellationRequested()\`, or pass the token to APIs that honour it.
- Cancelled operations throw \`OperationCanceledException\` (or \`TaskCanceledException\`).

**Where it comes from in ASP.NET Core**
- Action parameter \`CancellationToken ct\` (= \`HttpContext.RequestAborted\`) — fires when the client disconnects.
- \`BackgroundService.ExecuteAsync(stoppingToken)\` — fires on application shutdown.

**Pass it all the way down**
\`\`\`csharp
[HttpGet("{id}")]
public async Task<ActionResult<OrderDto>> Get(int id, CancellationToken ct)
    => await _mediator.Send(new GetOrderQuery(id), ct);

public async Task<OrderDto?> Handle(GetOrderQuery q, CancellationToken ct)
{
    var order = await _db.Orders.AsNoTracking()
        .Where(o => o.Id == q.Id)
        .Select(o => new OrderDto(o.Id, o.Total))
        .FirstOrDefaultAsync(ct);                       // EF Core cancels the SQL command

    var rating = await _http.GetFromJsonAsync<Rating>($"ratings/{q.Id}", ct);  // aborts the HTTP request
    return order;
}

// CPU-bound loops: check periodically
foreach (var row in rows)
{
    ct.ThrowIfCancellationRequested();
    Process(row);
}
\`\`\`

**Timeouts and linking**
\`\`\`csharp
using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);
await _client.CallAsync(linked.Token);   // cancelled by the client disconnect OR after 5 s
\`\`\`

**Good practices**
- Make \`CancellationToken ct = default\` the **last parameter** of async methods.
- Dispose CTSs you create (they may hold timers).
- Don't treat \`OperationCanceledException\` as an error in logs when the client disconnected (filter it in the global exception handler).
- Be careful before cancelling **writes**: cancelling halfway through a multi-step operation can leave inconsistent state — sometimes you pass \`CancellationToken.None\` to the final commit on purpose.`,
  },
  {
    id: 'async-lock-semaphoreslim',
    category: 'Async & Concurrency (.NET)',
    difficulty: 3,
    question: 'lock vs SemaphoreSlim: why can\'t you use await inside a lock? (plus Interlocked, ConcurrentDictionary)',
    tldr: 'lock (Monitor) has thread affinity — it must be released by the thread that acquired it, but after an await you may resume on a different thread, so the compiler forbids await inside lock. For async code use SemaphoreSlim(1,1) with WaitAsync/Release; for simple counters use Interlocked; for shared maps use ConcurrentDictionary.',
    answer: `**lock** = \`Monitor.Enter/Exit\` with **thread affinity**: the lock is owned by a thread and must be released by the same thread. An \`await\` can resume on a different thread, and holding a blocking lock across a long await would block other threads anyway — so \`await\` inside \`lock\` is a **compile error**.

**SemaphoreSlim** has no thread affinity and supports async waiting:
\`\`\`csharp
private readonly SemaphoreSlim _mutex = new(1, 1);     // async mutex

public async Task<Token> GetTokenAsync(CancellationToken ct)
{
    if (_token is { IsExpired: false }) return _token;
    await _mutex.WaitAsync(ct);
    try
    {
        if (_token is { IsExpired: false }) return _token;        // double-check after acquiring
        _token = await _authClient.RequestTokenAsync(ct);         // await while "locked" is fine
        return _token;
    }
    finally
    {
        _mutex.Release();
    }
}
\`\`\`
\`SemaphoreSlim(n)\` also limits concurrency to **n** (e.g. max 5 parallel calls).

**Choosing a primitive**
- \`lock\` (or .NET 9 \`System.Threading.Lock\`): short **synchronous** critical sections, no awaits.
- \`SemaphoreSlim\`: async critical sections, throttling.
- \`Interlocked\`: atomic operations on single variables — fastest, lock-free.
\`\`\`csharp
Interlocked.Increment(ref _requestCount);
Interlocked.CompareExchange(ref _state, newValue, expected);
\`\`\`
- \`ConcurrentDictionary<TKey,TValue>\`: thread-safe map. Note: the factory in \`GetOrAdd\` **can run more than once** under contention — wrap in \`Lazy<T>\` if the factory is expensive or has side effects:
\`\`\`csharp
var client = _clients.GetOrAdd(tenantId, id => new Lazy<TenantClient>(() => Create(id))).Value;
\`\`\`
- \`ReaderWriterLockSlim\`: many readers / one writer (sync only).
- \`Channel<T>\`: producer/consumer without explicit locking.
- Immutable collections / \`FrozenDictionary\`: replace instead of mutate.

**Pitfalls**: never \`lock(this)\`, \`lock(typeof(X))\` or on strings (others can lock the same object); always \`Release()\` in \`finally\`; SemaphoreSlim is not reentrant (awaiting it twice in the same flow deadlocks); in a scaled-out app (several instances) in-process locks don't help — you need a distributed lock or DB-level concurrency.`,
  },
  {
    id: 'async-concurrency-vs-parallelism',
    category: 'Async & Concurrency (.NET)',
    difficulty: 2,
    question: 'What is the difference between concurrency and parallelism (in .NET terms)?',
    tldr: 'Concurrency is dealing with many tasks in progress at the same time (often interleaved, e.g. async I/O on few threads); parallelism is executing work simultaneously on multiple cores. In .NET: async/await and Task.WhenAll for I/O-bound concurrency, Parallel.For/PLINQ for CPU-bound parallelism.',
    answer: `**Concurrency**: multiple operations **in progress** over the same period. They may interleave on a single thread. Example: a web server awaiting 1,000 database calls with a handful of threads.

**Parallelism**: multiple operations **executing at the same instant** on different CPU cores. Example: resizing 1,000 images using all 8 cores.

You can have concurrency without parallelism (async I/O on one thread) and parallelism as one way to achieve concurrency.

**.NET tools by workload**
| Workload | Tool | Why |
|---|---|---|
| I/O-bound, many operations | \`async/await\`, \`Task.WhenAll\`, \`Parallel.ForEachAsync\` | threads are released while waiting |
| CPU-bound, data parallel | \`Parallel.For/ForEach\`, PLINQ (\`AsParallel()\`) | splits work across cores |
| CPU-bound in a UI app | \`await Task.Run(...)\` | keeps the UI thread responsive |
| Producer/consumer pipelines | \`Channel<T>\`, TPL Dataflow | bounded queues, backpressure |
| Streaming async data | \`IAsyncEnumerable<T>\` + \`await foreach\` | process items as they arrive |

\`\`\`csharp
// concurrency: 3 independent I/O calls, total time ≈ the slowest one
var userTask = _users.GetAsync(id, ct);
var ordersTask = _orders.GetForUserAsync(id, ct);
var recsTask = _recs.GetAsync(id, ct);
await Task.WhenAll(userTask, ordersTask, recsTask);

// parallelism: CPU-heavy work across cores
Parallel.ForEach(images, new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount },
    img => img.Resize(800, 600));
\`\`\`

**Pitfalls**
- \`Parallel.ForEach\` with blocking I/O wastes threads; \`Task.Run\` around I/O in ASP.NET Core adds overhead without benefit.
- Shared state in parallel code needs synchronisation (\`Interlocked\`, concurrent collections) — or better, avoid sharing.
- **Don't run multiple operations concurrently on the same \`DbContext\`** — it's not thread-safe; use separate contexts (\`IDbContextFactory\`).`,
  },
  {
    id: 'async-whenall-exceptions',
    category: 'Async & Concurrency (.NET)',
    difficulty: 3,
    question: 'What happens to exceptions if two tasks in Task.WhenAll throw?',
    tldr: '`await Task.WhenAll(...)` rethrows only the first exception; the returned task\'s Exception property is an AggregateException containing all of them. To see every failure, keep a reference to the WhenAll task and inspect .Exception, or inspect each task.',
    answer: `\`WhenAll\` waits for **all** tasks to finish (it doesn't stop at the first failure). If any fail, the resulting task is **Faulted** with an \`AggregateException\` containing **all** exceptions. But \`await\` unwraps it and throws **only the first** one.

\`\`\`csharp
var t1 = Task.Run(() => throw new InvalidOperationException("A"));
var t2 = Task.Run(() => throw new ArgumentException("B"));

try
{
    await Task.WhenAll(t1, t2);
}
catch (Exception ex)
{
    Console.WriteLine(ex.Message);   // "A" only
}
\`\`\`

**Getting all exceptions**
\`\`\`csharp
var all = Task.WhenAll(t1, t2);
try
{
    await all;
}
catch
{
    foreach (var inner in all.Exception!.InnerExceptions)     // A and B
        _logger.LogError(inner, "Task failed");
    throw;
}

// or check each task
var failed = new[] { t1, t2 }.Where(t => t.IsFaulted).Select(t => t.Exception!.InnerException);
\`\`\`

**Related behaviour**
- \`.Wait()\` / \`.Result\` throw the **AggregateException** itself (another reason to prefer await).
- If tasks are **cancelled** and none faulted, the WhenAll task is Canceled → \`TaskCanceledException\`.
- Successful results are still available from the individual tasks (\`t3.Result\`) — useful for partial-success scenarios.
- \`Task.WhenAny\` returns the first completed task (not the first successful one) and **never throws** itself — you must await the returned task to observe its exception. Common use: timeouts / racing.
- .NET 9 adds \`Task.WhenEach\` to process tasks as they complete.

**Design question behind it**: should one failure fail the whole operation? Often the better design is per-item results:
\`\`\`csharp
var results = await Task.WhenAll(ids.Select(async id =>
{
    try { return Result.Ok(await _api.GetAsync(id, ct)); }
    catch (HttpRequestException ex) { return Result.Fail(id, ex.Message); }
}));
\`\`\``,
  },
  {
    id: 'async-channels-asyncenumerable',
    category: 'Async & Concurrency (.NET)',
    difficulty: 3,
    question: 'What are IAsyncEnumerable and Channels, and when do you use them?',
    tldr: 'IAsyncEnumerable<T> streams items asynchronously so you can process them as they arrive with await foreach; Channel<T> is a thread-safe, async producer/consumer queue (optionally bounded for backpressure), ideal for in-process background pipelines.',
    answer: `**IAsyncEnumerable<T>** — async streams (C# 8)
\`\`\`csharp
public async IAsyncEnumerable<Order> StreamOrdersAsync([EnumeratorCancellation] CancellationToken ct = default)
{
    await foreach (var order in _db.Orders.AsNoTracking().AsAsyncEnumerable().WithCancellation(ct))
        yield return order;               // one row at a time, no big List in memory
}

await foreach (var order in StreamOrdersAsync(ct))
    await _exporter.WriteAsync(order, ct);
\`\`\`
Uses: streaming large DB result sets, paging through an external API transparently, ASP.NET Core endpoints returning \`IAsyncEnumerable<T>\` (streamed JSON), gRPC streams.

**Channel<T>** — async producer/consumer queue (\`System.Threading.Channels\`)
\`\`\`csharp
// registration: one bounded channel shared by producers (requests) and a consumer (background service)
builder.Services.AddSingleton(Channel.CreateBounded<EmailJob>(new BoundedChannelOptions(1000)
{
    FullMode = BoundedChannelFullMode.Wait          // backpressure: producers wait when full
}));

// producer (e.g. in a request handler)
await channel.Writer.WriteAsync(new EmailJob(user.Email), ct);

// consumer
public class EmailWorker(Channel<EmailJob> channel, IServiceScopeFactory scopes) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in channel.Reader.ReadAllAsync(stoppingToken))
        {
            using var scope = scopes.CreateScope();
            var sender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
            try { await sender.SendAsync(job, stoppingToken); }
            catch (Exception ex) { /* log, retry or dead-letter */ }
        }
    }
}
\`\`\`
- **Bounded** channels give backpressure; **unbounded** can grow without limit.
- Multiple consumers = parallel processing with a natural concurrency limit.

**Limits — say this in the interview**: a Channel lives **in memory of one process**. Items are lost on restart or crash, and it doesn't distribute work across instances. For durable, cross-service work use **Azure Service Bus / RabbitMQ** (or Hangfire with persistent storage).`,
  },

  // =====================================================================
  // ASP.NET CORE
  // =====================================================================
  {
    id: 'asp-middleware-pipeline',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'How does the middleware pipeline work and why does the order matter? (Use, Run, Map, custom middleware)',
    tldr: 'Each request passes through middleware in registration order, each one able to act before and after calling next(); the response flows back in reverse. Order matters because e.g. exception handling must wrap everything, and authentication must run before authorization and the endpoints.',
    answer: `A request flows **in** through the middleware in registration order, reaches the endpoint, and the response flows back **out** in reverse order — like nested Russian dolls. Each middleware can short-circuit (not call \`next\`).

\`\`\`csharp
var app = builder.Build();

app.UseExceptionHandler();          // 1. outermost: catches exceptions from everything below
app.UseHsts();
app.UseHttpsRedirection();
app.UseStaticFiles();               // may short-circuit for static files (before auth = public)
app.UseRouting();                   // selects the endpoint
app.UseCors();                      // after routing, before auth
app.UseAuthentication();            // who are you? (sets HttpContext.User)
app.UseAuthorization();             // are you allowed? (needs the user AND the endpoint metadata)
app.UseRateLimiter();
app.UseOutputCache();
app.MapControllers();               // endpoints
app.Run();
\`\`\`

**Why order matters (examples)**
- Exception handler registered late can't catch errors from earlier middleware.
- \`UseAuthorization\` before \`UseAuthentication\` → user is always anonymous → 401s.
- \`UseCors\` after the endpoint → preflight requests fail.
- Static files before auth = public; after = protected.
- Response compression must run before middleware that writes the body.

**Use, Run, Map**
- \`app.Use(async (context, next) => { ...; await next(context); ... })\` — can run code before and after the next middleware.
- \`app.Run(async context => ...)\` — **terminal**, never calls next.
- \`app.Map("/health", branch => ...)\` / \`MapWhen(predicate, ...)\` — branch the pipeline by path or condition. \`UseWhen\` branches and rejoins.

**Custom middleware (convention-based)**
\`\`\`csharp
public class RequestTimingMiddleware(RequestDelegate next, ILogger<RequestTimingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-Elapsed-Ms"] = sw.ElapsedMilliseconds.ToString();
            return Task.CompletedTask;
        });
        await next(context);
        logger.LogInformation("{Path} took {Elapsed} ms", context.Request.Path, sw.ElapsedMilliseconds);
    }
}
app.UseMiddleware<RequestTimingMiddleware>();
\`\`\`
Conventional middleware is created **once** (singleton) — inject scoped services as **InvokeAsync parameters**, not constructor parameters (or implement \`IMiddleware\`, which is resolved per request).

Gotcha: you can't modify headers after the response has started (\`Response.HasStarted\`) — use \`OnStarting\`.`,
  },
  {
    id: 'asp-di-lifetimes',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'Explain DI lifetimes. What happens if you inject a Scoped service into a Singleton?',
    tldr: 'Transient: new instance every resolve; Scoped: one per request (scope); Singleton: one for the app. Injecting Scoped into Singleton creates a captive dependency: the scoped object (e.g. DbContext) lives forever, shared across requests and threads — ASP.NET Core throws in Development thanks to scope validation.',
    answer: `**Lifetimes**
- **Transient** — a new instance every time it's resolved. Lightweight, stateless services.
- **Scoped** — one instance per **scope**; in ASP.NET Core a scope = one HTTP request. \`DbContext\`, unit of work, per-request context (current user).
- **Singleton** — one instance for the whole application lifetime. Must be **thread-safe**. Caches, configuration, \`HttpClient\` handlers, clients like \`ServiceBusClient\`.

\`\`\`csharp
builder.Services.AddTransient<IPriceCalculator, PriceCalculator>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(cs));   // scoped
builder.Services.AddSingleton<IClock, SystemClock>();
\`\`\`

**Captive dependency** — a longer-lived service holding a shorter-lived one:
\`\`\`csharp
public class ReportCache(AppDbContext db) { }      // registered as Singleton ✘
\`\`\`
- The \`DbContext\` is created once and never disposed → stale change tracker, growing memory.
- Shared across concurrent requests → \`DbContext\` is **not thread-safe** → "A second operation was started on this context" exceptions, data corruption.
- Scoped data (current user, tenant) leaks between users — a **security bug**.

**Protection**: \`ValidateScopes\` (on by default in Development) throws \`InvalidOperationException: Cannot consume scoped service from singleton\`. Enable it everywhere:
\`\`\`csharp
builder.Host.UseDefaultServiceProvider(o => { o.ValidateScopes = true; o.ValidateOnBuild = true; });
\`\`\`

**Correct way when a singleton needs scoped work** (e.g. a \`BackgroundService\`):
\`\`\`csharp
public class CleanupService(IServiceScopeFactory scopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Sessions.Where(s => s.Expired).ExecuteDeleteAsync(ct);
    }
}
\`\`\`
Or \`IDbContextFactory<T>\` for short-lived contexts in singletons.

**Rule**: a service may only depend on services with the **same or longer** lifetime. Transient → anything; Scoped → Scoped/Singleton; Singleton → Singleton only.

Also: transient \`IDisposable\` services resolved from the root provider are kept until app shutdown (memory leak) — resolve them from a scope.`,
    followUps: [
      { q: 'Can a Singleton depend on a Transient?', a: 'Technically yes and scope validation will not complain, but the transient instance effectively becomes a singleton (resolved once). That is fine only if the transient is stateless and thread-safe.' },
    ],
  },
  {
    id: 'asp-middleware-vs-filters',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'Middleware vs filters — when do you use which?',
    tldr: 'Middleware runs for every request in the pipeline and knows only HttpContext; filters run inside MVC/endpoint execution and know about the selected action, its arguments, model state and result. Use middleware for cross-cutting HTTP concerns, filters for action-level concerns.',
    answer: `**Middleware**
- Part of the request pipeline; runs for **all** requests (static files, health checks, minimal APIs, controllers).
- Only sees \`HttpContext\` — not which controller action will run or its parameters.
- Typical uses: exception handling, logging/correlation IDs, authentication, CORS, compression, rate limiting, security headers, request timing.

**Filters** (MVC / Razor Pages; endpoint filters for minimal APIs)
- Run **after routing has selected an action**, around its execution, with access to the action context: action arguments, model binding results, \`ModelState\`, the \`IActionResult\`, attributes on the action.
- Can be applied **globally, per controller or per action** (attributes).
- Pipeline order: **Authorization → Resource → (model binding) → Action → Exception → Result** filters.

\`\`\`csharp
// action filter: validate arguments, short-circuit with ProblemDetails
public class ValidateModelFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.ModelState.IsValid)
            context.Result = new BadRequestObjectResult(new ValidationProblemDetails(context.ModelState));
    }
    public void OnActionExecuted(ActionExecutedContext context) { }
}

// minimal API endpoint filter
app.MapPost("/orders", CreateOrder)
   .AddEndpointFilter(async (ctx, next) =>
   {
       var cmd = ctx.GetArgument<CreateOrderCommand>(0);
       return cmd.Items.Count == 0 ? Results.BadRequest("No items") : await next(ctx);
   });
\`\`\`

**Rule of thumb**
- Needs to run for every request, independent of MVC → **middleware**.
- Needs action metadata, arguments or the result object, or applies to a subset of actions → **filter**.
- Exception handling: prefer the global **\`IExceptionHandler\` / \`UseExceptionHandler\` middleware** — it also catches errors outside MVC; exception filters only see exceptions from actions.
- Authorization: use the built-in policies (\`[Authorize(Policy = ...)]\`) rather than custom auth filters.`,
  },
  {
    id: 'asp-httpclientfactory',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'Why shouldn\'t you create HttpClient with new on every call?',
    tldr: 'Disposing an HttpClient per call closes its connections, leaving sockets in TIME_WAIT and leading to socket exhaustion under load; a single static client never refreshes DNS. IHttpClientFactory pools and rotates handlers, and adds configuration and resilience via typed/named clients.',
    answer: `**Problem 1 — socket exhaustion**
\`\`\`csharp
// ✘ in a loop or per request
using var client = new HttpClient();
var res = await client.GetAsync(url);
\`\`\`
Each disposed client closes its underlying connections; the OS keeps sockets in **TIME_WAIT** for up to ~240 s. Under load you run out of ephemeral ports → \`SocketException: Only one usage of each socket address...\`. You also lose connection reuse (new TCP + TLS handshake each time → slower).

**Problem 2 — a single static HttpClient forever** solves exhaustion but **never re-resolves DNS**, so after a failover or blue-green swap traffic still goes to the old IP.

**Solution: \`IHttpClientFactory\`**
- Pools \`HttpMessageHandler\`s and **rotates them** (default lifetime 2 minutes) → connection reuse **and** DNS refresh.
- Central configuration: base address, headers, timeouts, auth handlers.
- Integrates **resilience** (retries, circuit breaker) and logging via delegating handlers.

\`\`\`csharp
// typed client
builder.Services.AddHttpClient<IPaymentsClient, PaymentsClient>(c =>
{
    c.BaseAddress = new Uri(builder.Configuration["Payments:BaseUrl"]!);
    c.Timeout = TimeSpan.FromSeconds(10);
})
.AddHttpMessageHandler<CorrelationIdHandler>()
.AddStandardResilienceHandler();      // Microsoft.Extensions.Http.Resilience: retry + circuit breaker + timeouts

public class PaymentsClient(HttpClient http) : IPaymentsClient
{
    public Task<PaymentStatus?> GetStatusAsync(string id, CancellationToken ct)
        => http.GetFromJsonAsync<PaymentStatus>($"payments/{id}", ct);
}
\`\`\`

**Alternative without the factory** (e.g. a singleton client in a console app or library):
\`\`\`csharp
var client = new HttpClient(new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(2)   // recycles connections → DNS refresh
});
\`\`\`

**Gotchas**
- **Typed clients are transient**; don't inject them into singletons (the handler would never rotate) — inject \`IHttpClientFactory\` and call \`CreateClient\`.
- Always dispose \`HttpResponseMessage\` (or use \`GetFromJsonAsync\`).
- Pass \`CancellationToken\` and set timeouts; the default \`HttpClient.Timeout\` is 100 s.`,
  },
  {
    id: 'asp-global-exception-handling',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'How do you implement global exception handling in an API?',
    tldr: 'Use the exception handler middleware with IExceptionHandler implementations (.NET 8+) and AddProblemDetails, mapping known exceptions to proper status codes and RFC 9457 ProblemDetails, logging unexpected ones, and never leaking stack traces in production.',
    answer: `**Goals**: one consistent error format, correct status codes, no stack traces leaked, every unexpected error logged with a trace ID.

\`\`\`csharp
// Program.cs
builder.Services.AddProblemDetails(o =>
    o.CustomizeProblemDetails = ctx =>
        ctx.ProblemDetails.Extensions["traceId"] = Activity.Current?.Id ?? ctx.HttpContext.TraceIdentifier);

builder.Services.AddExceptionHandler<ValidationExceptionHandler>();   // specific first
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();       // fallback last

app.UseExceptionHandler();      // early in the pipeline
app.UseStatusCodePages();       // ProblemDetails for 404/405 etc. without a body
\`\`\`

\`\`\`csharp
public sealed class ValidationExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        if (ex is not ValidationException ve) return false;          // let the next handler try
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = ctx,
            ProblemDetails = new HttpValidationProblemDetails(
                ve.Errors.GroupBy(e => e.PropertyName)
                         .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()))
            { Title = "Validation failed" },
            Exception = ex,
        });
    }
}

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IProblemDetailsService pd) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var (status, title) = ex switch
        {
            NotFoundException       => (404, "Resource not found"),
            ConflictException       => (409, "Conflict"),
            UnauthorizedAccessException => (403, "Forbidden"),
            OperationCanceledException when ctx.RequestAborted.IsCancellationRequested => (499, "Client closed request"),
            _                       => (500, "An unexpected error occurred"),
        };
        if (status == 500) logger.LogError(ex, "Unhandled exception");
        ctx.Response.StatusCode = status;
        return await pd.TryWriteAsync(new() { HttpContext = ctx, Exception = ex,
            ProblemDetails = { Title = title, Status = status } });
    }
}
\`\`\`

**Response example (RFC 9457 / 7807)**
\`\`\`json
{ "type": "https://tools.ietf.org/html/rfc9110#section-15.5.5", "title": "Resource not found",
  "status": 404, "traceId": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" }
\`\`\`

**Design notes**
- Expected business failures (not found, validation) can be modelled as **results** instead of exceptions (\`Results.NotFound()\`, a \`Result<T>\` type) — exceptions are for exceptional cases.
- Before .NET 8: custom middleware with try/catch around \`next\`, or \`UseExceptionHandler(builder => ...)\`.
- In Development, \`UseDeveloperExceptionPage\` shows details; never in production.`,
  },
  {
    id: 'asp-options-pattern',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'IOptions vs IOptionsSnapshot vs IOptionsMonitor — what are the differences?',
    tldr: 'IOptions<T> is a singleton read once at startup; IOptionsSnapshot<T> is scoped and re-reads configuration per request; IOptionsMonitor<T> is a singleton that always returns the current value and notifies on changes — usable from singletons.',
    answer: `**Options pattern**: bind a configuration section to a strongly typed class, validate it, inject it.
\`\`\`csharp
public sealed class SmtpOptions
{
    public const string Section = "Smtp";
    [Required] public string Host { get; init; } = "";
    [Range(1, 65535)] public int Port { get; init; } = 587;
}

builder.Services.AddOptions<SmtpOptions>()
    .BindConfiguration(SmtpOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();            // fail fast at startup instead of at first use
\`\`\`

| | Lifetime | Reloads on config change | Named options | Use from singleton |
|---|---|---|---|---|
| \`IOptions<T>\` | Singleton | no (value computed once) | no | yes |
| \`IOptionsSnapshot<T>\` | Scoped | yes, per request | yes | no |
| \`IOptionsMonitor<T>\` | Singleton | yes, \`CurrentValue\` + \`OnChange\` | yes | yes |

\`\`\`csharp
public class EmailSender(IOptions<SmtpOptions> options)            // static config, simplest
{ private readonly SmtpOptions _o = options.Value; }

public class FeatureController(IOptionsSnapshot<FeatureOptions> o)  // consistent value within one request
{ }

public class TokenCache : IDisposable                               // singleton reacting to changes
{
    private readonly IOptionsMonitor<AuthOptions> _monitor;
    private readonly IDisposable? _subscription;

    public TokenCache(IOptionsMonitor<AuthOptions> monitor)
    {
        _monitor = monitor;
        _subscription = monitor.OnChange(_ => Invalidate());     // called when config reloads
    }
    private AuthOptions Current => _monitor.CurrentValue;         // always the latest value
    private void Invalidate() { /* drop cached tokens */ }
    public void Dispose() => _subscription?.Dispose();
}
\`\`\`

**When reloading matters**: \`appsettings.json\` with \`reloadOnChange\`, **Azure App Configuration** with refresh, Key Vault secret rotation, Kubernetes ConfigMaps mounted as files.

**Named options**: several configurations of the same type (\`monitor.Get("Primary")\`, \`snapshot.Get("Backup")\`).

**Good practices**: validate on start, keep options classes small and per feature, prefer \`IOptions\` unless you really need live reload, and don't inject \`IConfiguration\` everywhere.`,
  },
  {
    id: 'asp-background-tasks',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'How do you run background work in an ASP.NET Core application?',
    tldr: 'Implement a BackgroundService (IHostedService) for long-running loops or queue consumers, create a DI scope per unit of work, honour the stopping token; for durable, retryable or scheduled jobs use Hangfire/Quartz, a message broker, or Azure Functions instead of in-process fire-and-forget.',
    answer: `**IHostedService / BackgroundService** — runs with the host's lifetime.
\`\`\`csharp
public sealed class OutboxPublisher(IServiceScopeFactory scopes, ILogger<OutboxPublisher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();                    // fresh DbContext per iteration
                var publisher = scope.ServiceProvider.GetRequiredService<IOutboxProcessor>();
                await publisher.PublishPendingAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Outbox iteration failed");           // don't let one failure kill the loop
            }
        }
    }
}
builder.Services.AddHostedService<OutboxPublisher>();
\`\`\`

**Key points**
- Hosted services are **singletons** → use \`IServiceScopeFactory\` for scoped dependencies (DbContext).
- Respect \`stoppingToken\` for graceful shutdown (\`HostOptions.ShutdownTimeout\`).
- Unhandled exceptions in \`ExecuteAsync\` stop the host by default (.NET 6+ \`BackgroundServiceExceptionBehavior.StopHost\`) — catch and log inside the loop.
- In-request work queue: \`Channel<T>\` + BackgroundService consumer (see the Channels question).

**When in-process background work is not enough**
- **Multiple instances**: every instance runs the BackgroundService → duplicates. Need leader election, a distributed lock, or partitioning.
- **Durability**: work in memory is lost on restart/deploy/crash.
- **Scheduling, retries, dashboards**: **Hangfire** (persistent storage, retries, dashboard) or **Quartz.NET** (cron scheduling, clustering).
- **Decoupled processing**: publish a message to **Azure Service Bus** and consume it in a worker service or **Azure Function**.
- **Worker Service** template (\`dotnet new worker\`) to run background processing as a separate deployable, scaled independently from the API.

**Interview framing**: "For a periodic cleanup I'd use a BackgroundService with a scope per iteration. For anything that must not be lost — sending invoices, integrations — a message on Service Bus processed by a separate worker with retries and a dead-letter queue."`,
  },
  {
    id: 'asp-api-versioning',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'How have you versioned APIs, and why that way?',
    tldr: 'Prefer additive, backward-compatible changes; when a breaking change is needed, version explicitly (usually URL segment /v2 with Asp.Versioning), run versions side by side, document them in OpenAPI per version and deprecate the old one with a timeline.',
    answer: `**Explain your choice and the reasoning** — interviewers care about trade-offs more than the mechanism.

**Strategies**
- **URL segment** \`/api/v2/orders\` — explicit, cache-friendly, easy to route in gateways and to read in logs. Most common choice.
- **Query string** \`?api-version=2.0\` — Azure-style; easy to default.
- **Header / media type** \`api-version: 2\` / \`Accept: application/json;v=2\` — clean URLs, less visible, harder to test in a browser.

**Implementation with \`Asp.Versioning\`**
\`\`\`csharp
builder.Services.AddApiVersioning(o =>
{
    o.DefaultApiVersion = new ApiVersion(1, 0);
    o.AssumeDefaultVersionWhenUnspecified = true;
    o.ReportApiVersions = true;                         // api-supported-versions / api-deprecated-versions headers
    o.ApiVersionReader = new UrlSegmentApiVersionReader();
}).AddApiExplorer(o => { o.GroupNameFormat = "'v'VVV"; o.SubstituteApiVersionInUrl = true; });

[ApiController]
[ApiVersion("1.0", Deprecated = true)]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/orders")]
public class OrdersController : ControllerBase
{
    [HttpGet("{id}"), MapToApiVersion("1.0")] public OrderDtoV1 GetV1(int id) => ...;
    [HttpGet("{id}"), MapToApiVersion("2.0")] public OrderDtoV2 GetV2(int id) => ...;
}
\`\`\`
Generate one OpenAPI/Swagger document per version.

**Process**
- Avoid new versions where possible: add fields, add endpoints, keep old fields; clients should ignore unknown fields.
- Breaking change → new version, both running in parallel; shared logic in the application layer, only DTOs/mapping differ per version.
- **Deprecation**: mark as deprecated, communicate a sunset date, monitor usage per client (App Insights by version), then remove.
- Contract tests or OpenAPI diff in CI to catch accidental breaking changes.

**Sample answer**: "We used URL segment versioning with Asp.Versioning because our consumers were other teams and a mobile app — explicit URLs made routing in API Management and troubleshooting easy. We kept v1 for six months after releasing v2, tracked usage in Application Insights and removed it once traffic dropped to zero."`,
  },
  {
    id: 'asp-controllers-vs-minimal',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'Controllers or Minimal APIs: which do you choose for a new project, and why?',
    tldr: 'Both are production-ready and share the same pipeline. Minimal APIs are leaner, faster to start, AOT-friendly and fit vertical slices; controllers give conventions, filters, model-binding features and familiar structure for large teams. Choose based on team, size and organisation — and be consistent.',
    answer: `**Minimal APIs**
\`\`\`csharp
var orders = app.MapGroup("/api/orders").RequireAuthorization().WithTags("Orders");

orders.MapGet("/{id:int}", async Task<Results<Ok<OrderDto>, NotFound>> (int id, ISender sender, CancellationToken ct) =>
    await sender.Send(new GetOrderQuery(id), ct) is { } dto ? TypedResults.Ok(dto) : TypedResults.NotFound());

orders.MapPost("/", async (CreateOrderCommand cmd, ISender sender, CancellationToken ct) =>
{
    var id = await sender.Send(cmd, ct);
    return TypedResults.Created($"/api/orders/{id}", id);
}).AddEndpointFilter<ValidationFilter<CreateOrderCommand>>();
\`\`\`
- ✔ Less ceremony, explicit dependencies per endpoint, great with **vertical slice** architecture, slightly better performance, **Native AOT** support, \`TypedResults\` give accurate OpenAPI metadata.
- ✘ Large APIs need discipline to organise (route groups, extension methods per feature, libraries like Carter/FastEndpoints); some MVC features are missing or different (endpoint filters instead of action filters, model binding is simpler).

**Controllers**
- ✔ Well-known conventions, attribute routing, rich filter pipeline, \`[ApiController]\` behaviours (automatic 400 on invalid ModelState), easy for big or mixed-experience teams, lots of existing examples and tooling.
- ✘ More boilerplate; controllers tend to grow and inject many dependencies (constructor injection for all actions).

**A balanced answer**
"For a new, small-to-medium service I'd pick **Minimal APIs** with route groups per feature — they fit our CQRS handlers well (endpoint → \`ISender.Send\`). For a large existing codebase or a team used to MVC I'd stay with **controllers**; mixing both styles without a reason hurts consistency. Performance difference is rarely the deciding factor — organisation and team familiarity are."`,
  },
  {
    id: 'asp-slow-endpoint',
    category: 'ASP.NET Core',
    difficulty: 3,
    question: 'How would you speed up an endpoint that responds slowly?',
    tldr: 'Measure first (Application Insights / OpenTelemetry traces, dotnet-counters, profiler) to find where time goes; then fix the dominant cause — usually EF Core queries, sequential I/O, sync-over-async or missing caching — and verify with load tests.',
    answer: `**1. Measure, don't guess**
- **Application Insights / OpenTelemetry** end-to-end transaction view: how much time is SQL, outbound HTTP, or the app itself? Compare p50 vs p95/p99.
- EF Core: log SQL with timing (\`LogTo\`, \`EnableSensitiveDataLogging\` in dev), SQL Server **Query Store** / execution plans.
- \`dotnet-counters\` (thread pool queue length, GC, exceptions/sec), \`dotnet-trace\` / Visual Studio profiler / dotTrace for CPU hotspots.

**2. Typical causes and fixes**
- **Database**
  - N+1 queries → projection with \`Select\` into DTOs / \`Include\`.
  - Missing indexes → execution plan, add (covering) index.
  - Loading too much → \`AsNoTracking\`, select only needed columns, **pagination**.
  - Cartesian explosion with several \`Include\`s → \`AsSplitQuery()\`.
- **Sequential remote calls** → \`Task.WhenAll\`; batch endpoints.
- **Sync-over-async / blocking** (\`.Result\`) → thread-pool starvation → async all the way.
- **No caching** of expensive, rarely changing data:
\`\`\`csharp
// .NET 9 HybridCache: L1 memory + L2 Redis, stampede protection
public async Task<ProductDto?> GetProduct(int id, CancellationToken ct) =>
    await _cache.GetOrCreateAsync($"product:{id}",
        async token => await _db.Products.AsNoTracking()
            .Where(p => p.Id == id).Select(p => new ProductDto(p.Id, p.Name, p.Price))
            .FirstOrDefaultAsync(token),
        new HybridCacheEntryOptions { Expiration = TimeSpan.FromMinutes(10) },
        cancellationToken: ct);
\`\`\`
  Plus **output caching** (\`app.UseOutputCache()\`, \`.CacheOutput()\`) for whole responses, and HTTP caching headers / CDN.
- **Large payloads** → pagination, response compression, smaller DTOs, \`System.Text.Json\` source generation.
- **Heavy work in the request** (PDF generation, emails) → move to a background job/queue and return \`202 Accepted\`.
- **Cold starts / startup work** → warm-up, avoid lazy initialisation on the first request.
- **Logging too much** synchronously, exceptions used for control flow.

**3. Verify**: load test (k6, NBomber, Azure Load Testing) before and after; set an alert on p95 latency so it doesn't regress.

**Sample answer framing**: "On our project an endpoint took 4 s; App Insights showed 38 SQL calls per request — an N+1 from lazy loading. Projecting to a DTO in one query plus an index on CustomerId brought it to 120 ms."`,
  },
  {
    id: 'asp-caching-options',
    category: 'ASP.NET Core',
    difficulty: 2,
    question: 'What caching options do you have in ASP.NET Core (in-memory, distributed, output caching, HybridCache)?',
    tldr: 'IMemoryCache is fast but per instance; IDistributedCache (Redis) is shared across instances; output caching caches whole HTTP responses on the server; HybridCache (.NET 9) combines memory + distributed with stampede protection; plus HTTP response caching headers and CDNs.',
    answer: `| Option | Where | Shared across instances | Typical use |
|---|---|---|---|
| \`IMemoryCache\` | process memory | no | small reference data, per-instance hot data |
| \`IDistributedCache\` (Redis, SQL) | external store | yes | sessions, data shared between instances |
| \`HybridCache\` (.NET 9) | L1 memory + L2 distributed | yes (L2) | general-purpose app caching, stampede protection |
| Output caching | server, whole responses | per instance (or Redis store) | GET endpoints with the same response for many users |
| HTTP caching / CDN | client, proxies, edge | n/a | public static or semi-static content |

\`\`\`csharp
// IMemoryCache
var product = await _memory.GetOrCreateAsync($"product:{id}", entry =>
{
    entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
    entry.Size = 1;                                  // when SizeLimit is configured
    return _repo.GetAsync(id);
});

// Output caching
builder.Services.AddOutputCache(o => o.AddPolicy("Products", p => p.Expire(TimeSpan.FromMinutes(1)).Tag("products")));
app.UseOutputCache();
app.MapGet("/products", GetProducts).CacheOutput("Products");
await _outputCacheStore.EvictByTagAsync("products", ct);   // invalidate after an update

// Redis distributed cache
builder.Services.AddStackExchangeRedisCache(o => o.Configuration = builder.Configuration["Redis"]);
builder.Services.AddHybridCache();                          // uses the registered IDistributedCache as L2
\`\`\`

**Things a senior mentions**
- **Invalidation strategy**: TTL + explicit eviction on writes (tags), event-driven invalidation across instances.
- **Cache stampede**: many requests rebuild the same missing key → \`HybridCache\` / locking / jittered TTLs.
- **Memory limits**: \`SizeLimit\` on \`MemoryCache\`, don't cache unbounded per-user data.
- **Per-user data** must include the user/tenant in the key — never cache personalised responses publicly (output caching ignores authenticated requests by default for that reason).
- Serialisation cost and network latency of Redis; Azure Cache for Redis tiers.
- Measure the hit ratio; a cache that's never hit is just complexity.`,
  },
]);
