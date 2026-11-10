/*
  .NET TRACK: C# & .NET FUNDAMENTALS
  Format: see the comment at the top of questions.js
*/
addQuestions('dotnet', [
  {
    id: 'net-class-struct-record',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'What is the difference between class, struct and record? When do you use each?',
    tldr: 'class is a reference type with reference equality; struct is a value type copied on assignment; record (class or struct) adds compiler-generated value equality, ToString, deconstruction and non-destructive mutation with `with` — ideal for immutable data.',
    answer: `**class** — reference type
- Lives on the managed heap; variables hold a **reference**. Assigning copies the reference, so both variables point to the same object.
- Equality by **reference** (unless you override \`Equals\`).
- Supports inheritance. The default choice for entities, services and anything with identity or behaviour.

**struct** — value type
- Assigning or passing copies the **whole value**. No inheritance (can implement interfaces).
- Good for **small (≈ ≤ 16 bytes), immutable, short-lived** values: coordinates, money, keys. Avoids GC allocations.
- Pitfalls: large structs are expensive to copy; mutable structs cause bugs (you modify a copy); casting to an interface or \`object\` **boxes** it.
- Use \`readonly struct\` to guarantee immutability and let the compiler avoid defensive copies.

**record** (C# 9) / **record struct** (C# 10)
- \`record\` = \`record class\`: still a reference type, but with **value-based equality**, a nice \`ToString\`, \`Deconstruct\`, and \`with\` expressions.
- \`record struct\`: the same features for a value type (\`readonly record struct\` for immutability).

\`\`\`csharp
public record Money(decimal Amount, string Currency);          // immutable (init-only) positional record
var a = new Money(10, "EUR");
var b = new Money(10, "EUR");
Console.WriteLine(a == b);            // True  — value equality
var c = a with { Amount = 20 };       // non-destructive copy

public readonly record struct Point(int X, int Y);             // small value type, no heap allocation

public class Order                                              // entity with identity and behaviour
{
    public Guid Id { get; } = Guid.NewGuid();
    private readonly List<OrderLine> _lines = new();
    public void AddLine(OrderLine line) { /* invariants */ _lines.Add(line); }
}
\`\`\`

**When to use what**
- **class**: entities with identity, services, mutable objects with behaviour, EF Core entities.
- **record**: DTOs, commands/queries (MediatR requests), events, value objects — immutable data compared by value.
- **struct / readonly record struct**: tiny, hot-path values where avoiding allocations matters.

**Gotcha**: records' equality compares **all** members — including collections by reference (\`List<T>\` in a record compares by reference, not content).`,
    followUps: [
      { q: 'Are records immutable?', a: 'Positional records generate `init`-only properties, so they are shallowly immutable by default — but you can declare mutable properties, and a `List<T>` inside is still mutable. `record struct` (non-readonly) positional properties are actually mutable; use `readonly record struct`.' },
      { q: 'Should EF Core entities be records?', a: 'Usually not: entities have identity and are tracked by reference; value-based equality conflicts with change tracking. Records fit DTOs and value objects (mapped as owned/complex types).' },
    ],
  },
  {
    id: 'net-boxing',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'What are boxing and unboxing, and why can they hurt performance?',
    tldr: 'Boxing wraps a value type in a heap-allocated object when it is treated as object or an interface; unboxing copies it back out. Each box is an allocation plus copy and GC pressure — costly in hot loops.',
    answer: `**Boxing**: converting a value type (int, struct, enum) to \`object\` or to an interface it implements. The runtime **allocates an object on the heap**, copies the value into it and returns a reference.
**Unboxing**: an explicit cast back to the value type — a type check plus a **copy** out of the box.

\`\`\`csharp
int x = 42;
object o = x;          // boxing: heap allocation
int y = (int)o;        // unboxing: type check + copy
long z = (long)o;      // InvalidCastException — must unbox to the exact type
\`\`\`

**Why it hurts**
- Every box is a **heap allocation** → more GC work (Gen0 collections), cache misses.
- In hot paths (loops, logging, collections) it adds up quickly.
- Subtle bugs: modifying a boxed struct modifies the copy, not the original.

**Where it hides**
\`\`\`csharp
var list = new ArrayList(); list.Add(1);              // boxes — use List<int>
string s = string.Format("{0}", 5);                   // boxes the int (interpolation handlers avoid it)
IComparable c = 5;                                    // interface on a value type = boxing
void Log(object value) { }  Log(DateTime.Now);        // boxes
Dictionary<MyStruct, int> d;                          // boxes if MyStruct doesn't implement IEquatable<T>
enumValue.HasFlag(Flag.A);                            // boxed in old runtimes (JIT optimises it now)
\`\`\`

**How to avoid it**
- Use **generics** (\`List<T>\`, \`Dictionary<TKey,TValue>\`) instead of non-generic collections.
- Implement \`IEquatable<T>\` and override \`GetHashCode\` on structs used as keys.
- Generic methods with constraints (\`where T : struct, IComparable<T>\`) instead of interface parameters.
- Modern string interpolation (\`$"..."\`, .NET 6+ interpolated string handlers) and \`ILogger\` source-generated logging (\`[LoggerMessage]\`).

**How to detect**: allocation profilers (dotMemory, Visual Studio Diagnostic Tools, BenchmarkDotNet with \`[MemoryDiagnoser]\`), or IL inspection (\`box\` instruction).`,
  },
  {
    id: 'net-value-reference-stack-heap',
    category: 'C# & .NET',
    difficulty: 1,
    question: 'Value types vs reference types — and what about the stack and the heap?',
    tldr: 'Value types hold their data directly and are copied on assignment; reference types hold a reference to an object on the managed heap. "Value types live on the stack" is a simplification — they live wherever their container lives.',
    answer: `**Value types**: \`int\`, \`double\`, \`bool\`, \`decimal\`, \`DateTime\`, \`Guid\`, enums, structs, \`record struct\`.
- The variable **contains the data**. Assignment and parameter passing **copy** it.
- Cannot be null (except \`Nullable<T>\` / \`int?\`).

**Reference types**: \`class\`, \`record\`, \`string\`, arrays, delegates, interfaces.
- The variable holds a **reference** to an object on the **managed heap** (GC-managed). Assignment copies the reference.

\`\`\`csharp
var p1 = new PointStruct { X = 1 };  var p2 = p1;  p2.X = 99;   // p1.X is still 1 (copy)
var c1 = new PointClass  { X = 1 };  var c2 = c1;  c2.X = 99;   // c1.X is 99 (same object)
\`\`\`

**Stack vs heap — the nuanced version (seniors should say this)**
- The **stack** holds method frames: local variables and parameters. Allocation is just moving a pointer; freed automatically when the method returns.
- The **heap** holds objects; memory is reclaimed by the **garbage collector**.
- Value types are stored **where they are declared**: a local \`int\` is on the stack (or in a register), but an \`int\` **field of a class** lives inside that object on the heap, and elements of an \`int[]\` live in the array on the heap.
- Locals captured by a lambda or used across \`await\` are hoisted into a heap-allocated closure / state machine.
- \`ref struct\` types (like \`Span<T>\`) are guaranteed to stay on the stack.

**Passing semantics**: \`ref\`, \`out\` and \`in\` pass a variable **by reference**. Passing a reference type "by value" still lets the method mutate the object, but not replace the caller's reference.

**Why it matters**: allocations and GC pressure (performance), copy semantics bugs with mutable structs, and boxing.`,
  },
  {
    id: 'net-gc',
    category: 'C# & .NET',
    difficulty: 3,
    question: 'How does the .NET Garbage Collector work? What are generations and the LOH?',
    tldr: 'The GC is a generational, compacting, mark-and-sweep collector: most objects die young in Gen0, survivors are promoted to Gen1 and Gen2; objects ≥ 85,000 bytes go to the Large Object Heap, which is collected with Gen2 and not compacted by default.',
    answer: `**Mark → sweep → compact**
1. **Mark**: starting from **roots** (static fields, locals on thread stacks, CPU registers, GC handles), find all reachable objects.
2. **Sweep**: everything unreachable is garbage.
3. **Compact**: move surviving objects together to remove fragmentation, updating references.

**Generations** — based on the observation that most objects die young:
- **Gen0**: newly allocated small objects. Collected very often and cheaply.
- **Gen1**: survivors of Gen0; a buffer between short- and long-lived objects.
- **Gen2**: long-lived objects (caches, singletons, static data). A Gen2 (full) collection is expensive.
- Collecting Gen N also collects all younger generations.

**Large Object Heap (LOH)**: objects **≥ 85,000 bytes** (typically big arrays/strings). Logically part of Gen2, so collected only on full GCs, and **not compacted by default** → fragmentation. Avoid allocating large temporary buffers repeatedly — use \`ArrayPool<T>.Shared\`.
**Pinned Object Heap** (.NET 5+) for pinned buffers.

**Modes**
- **Workstation** (client apps) vs **Server GC** (one heap per core, higher throughput — default in ASP.NET Core).
- **Background/concurrent** GC lets app threads run during most of a Gen2 collection.
- Containers: the GC respects container memory limits (\`DOTNET_GCHeapHardLimit\`).

\`\`\`csharp
// avoid repeated LOH allocations
var buffer = ArrayPool<byte>.Shared.Rent(1_000_000);
try { /* use buffer */ }
finally { ArrayPool<byte>.Shared.Return(buffer); }

GC.GetGCMemoryInfo();             // diagnostics
GC.CollectionCount(0);            // Gen0 collection count
\`\`\`

**Practical guidance**
- Don't call \`GC.Collect()\` in production code.
- Reduce allocations in hot paths: \`Span<T>\`, pooling, structs, avoiding LINQ in tight loops, \`StringBuilder\`.
- Memory leaks in .NET = objects still **referenced** (static collections, event handlers never unsubscribed, captured closures, long-lived caches).
- Diagnose with \`dotnet-counters\` (GC heap size, gen collections, % time in GC), \`dotnet-gcdump\` / \`dotnet-dump\`, PerfView, dotMemory.
- The GC only manages **memory** — unmanaged resources (file handles, sockets, DB connections) need \`IDisposable\`.`,
    followUps: [
      { q: 'How can you have a memory leak in a garbage-collected language?', a: 'Objects stay reachable: a static list that only grows, an event handler on a long-lived publisher that is never unsubscribed, a singleton capturing scoped objects, unbounded caches, or timers. The GC cannot free what is still referenced.' },
    ],
  },
  {
    id: 'net-idisposable-finalizer',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'IDisposable vs finalizer — what is the difference, and when do you implement Dispose?',
    tldr: 'Dispose is deterministic cleanup you call (via using) to release resources immediately; a finalizer is a non-deterministic safety net the GC runs later, only needed when you directly own unmanaged handles (prefer SafeHandle instead).',
    answer: `**IDisposable / Dispose()**
- **Deterministic**: you decide when resources are released, usually with \`using\` / \`await using\`.
- Implement it when your class **owns** something that must be released: file/network streams, DB connections, \`HttpResponseMessage\`, timers, \`CancellationTokenSource\`, or other \`IDisposable\` fields.

\`\`\`csharp
using var connection = new SqlConnection(cs);      // disposed at the end of the scope
await using var stream = File.OpenRead(path);      // IAsyncDisposable
\`\`\`

**Finalizer (~ClassName)**
- Called by the GC **at some unknown time** after the object becomes unreachable, on the finalizer thread — maybe never if the process exits.
- Objects with finalizers survive an extra GC cycle (promoted to Gen1/Gen2) → slower.
- Only needed if you **directly** hold an **unmanaged** resource (raw \`IntPtr\` handle). In modern code, wrap handles in **\`SafeHandle\`**, which already has a finalizer, so you almost never write one.

**Dispose pattern** (for non-sealed classes that might be inherited):
\`\`\`csharp
public class ReportWriter : IDisposable
{
    private readonly FileStream _stream;
    private bool _disposed;

    public ReportWriter(string path) => _stream = File.Create(path);

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);          // no need to finalize: already cleaned up
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;
        if (disposing) _stream.Dispose();   // managed resources only when called from Dispose
        // free unmanaged resources here (if any)
        _disposed = true;
    }
}
\`\`\`
For a **sealed** class that only wraps managed disposables, a simple \`public void Dispose() => _stream.Dispose();\` is enough.

**Rules of thumb**
- Who creates it, disposes it. Don't dispose objects injected by DI — the container owns them.
- Dispose must be idempotent (safe to call twice); throw \`ObjectDisposedException\` on use after dispose.
- Don't dispose \`HttpClient\` per request — use \`IHttpClientFactory\` (socket exhaustion).
- \`DbContext\` from DI is scoped and disposed by the container.`,
  },
  {
    id: 'net-ienumerable-iqueryable',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'IEnumerable vs IQueryable: what happens when you call .Where() on each?',
    tldr: 'On IEnumerable, Where takes a delegate and filters in memory (LINQ to Objects); on IQueryable, Where takes an expression tree that the provider (EF Core) translates to SQL and runs in the database.',
    answer: `**IEnumerable<T>** (LINQ to Objects)
- \`Where(Func<T,bool>)\` — a compiled delegate executed **in memory**, item by item.
- If the source is a DB query that was already materialised (or cast to IEnumerable), **all rows are loaded first**, then filtered in .NET.

**IQueryable<T>** (LINQ providers such as EF Core)
- \`Where(Expression<Func<T,bool>>)\` — an **expression tree** (data describing the code).
- Operators compose into one query; the provider **translates** it (to SQL) when you enumerate (\`ToListAsync\`, \`FirstAsync\`, \`foreach\`).
- Filtering, sorting and paging happen **in the database**.

\`\`\`csharp
// ✔ IQueryable: SQL has WHERE + TOP, only 10 rows come back
var recent = await db.Orders
    .Where(o => o.Total > 100)
    .OrderByDescending(o => o.CreatedAt)
    .Take(10)
    .ToListAsync();

// ✘ AsEnumerable() switches to LINQ to Objects: loads ALL orders, filters in memory
var bad = db.Orders.AsEnumerable().Where(o => o.Total > 100).Take(10).ToList();

// ✘ same trap through a method signature
IEnumerable<Order> GetOrders() => db.Orders;            // returns IEnumerable
var slow = GetOrders().Where(o => o.Total > 100);       // in-memory filtering!
\`\`\`

**Consequences**
- Returning \`IEnumerable\` from a repository that wraps EF silently disables server-side filtering.
- Not every C# method can be translated: calling your own method inside an IQueryable \`Where\` throws "could not be translated" (EF Core 3+ no longer silently evaluates on the client).
- Returning \`IQueryable\` from a repository leaks persistence concerns to callers — a design trade-off (flexible vs. controlled).

**Also know**: both are **deferred** — nothing executes until enumeration.`,
  },
  {
    id: 'net-linq-deferred',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'What is deferred execution in LINQ, and how can it surprise you?',
    tldr: 'Most LINQ operators only build a query; it runs when you enumerate, and again every time you enumerate. Surprises: multiple enumeration, changed captured variables, disposed DbContext, and exceptions thrown later than expected.',
    answer: `**Deferred (lazy)**: \`Where\`, \`Select\`, \`OrderBy\`, \`Skip\`, \`Take\`, \`GroupBy\`... return a query object. Nothing runs until you iterate (\`foreach\`, \`ToList\`, \`Count\`, \`First\`...).
**Immediate**: \`ToList\`, \`ToArray\`, \`ToDictionary\`, \`Count\`, \`Sum\`, \`First\`, \`Any\`, \`Max\` execute right away.

**Surprise 1 — multiple enumeration**
\`\`\`csharp
var expensive = users.Where(u => CheckPermissionsViaHttp(u));   // nothing ran yet
if (expensive.Any())                 // runs the query (partially)
    foreach (var u in expensive) { } // runs it AGAIN — double HTTP calls / double DB queries
// fix: materialise once
var list = users.Where(...).ToList();
\`\`\`
For \`IQueryable\` each enumeration is a **new database round trip**.

**Surprise 2 — captured variables are read at execution time**
\`\`\`csharp
int min = 10;
var q = numbers.Where(n => n > min);
min = 100;
q.ToList();   // filters with min = 100
\`\`\`

**Surprise 3 — the source is gone**
\`\`\`csharp
IEnumerable<User> GetActive()
{
    using var db = new AppDbContext();
    return db.Users.Where(u => u.IsActive);   // returned unexecuted
}                                              // db disposed here
GetActive().ToList();   // ObjectDisposedException
\`\`\`

**Surprise 4 — exceptions appear late**: a bug inside a \`Select\` lambda throws where the query is enumerated (maybe in another layer), not where it was defined. Same for \`yield return\` iterators: argument validation runs only on first \`MoveNext\` (use a wrapper method to validate eagerly).

**Surprise 5 — the collection changed**: enumerating while modifying the underlying list throws \`InvalidOperationException\`, and a deferred query reflects later additions.

**Good practice**: materialise once with \`ToList()\` at clear boundaries (end of repository/query handler), use \`IReadOnlyList<T>\` in return types to signal "already executed", and enable analyzers that warn about possible multiple enumeration (CA1851, ReSharper).`,
  },
  {
    id: 'net-delegate-event',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'What is a delegate? How is an event different from a delegate? (Func, Action, lambdas, closures)',
    tldr: 'A delegate is a type-safe reference to a method (or a list of methods); Func and Action are built-in generic delegates. An event wraps a delegate so outsiders can only subscribe (+=) and unsubscribe (-=), while only the owner can raise it.',
    answer: `**Delegate**: a type describing a method signature; an instance points to one or more methods (multicast).
\`\`\`csharp
public delegate decimal PriceRule(decimal price);
PriceRule rule = p => p * 0.9m;
rule += p => p - 5;            // multicast: both run; the return value of the last one is returned
\`\`\`
**Built-ins**: \`Action<T...>\` (returns void), \`Func<T..., TResult>\` (returns a value), \`Predicate<T>\`. You rarely need custom delegate types today.

**Lambdas and closures**
- A lambda is an anonymous function (\`x => x * 2\`) converted to a delegate or an expression tree.
- If it uses outer variables, the compiler creates a **closure** class holding them — captured **by reference** (the variable, not its value) and **heap-allocated**.
- \`static\` lambdas (\`static x => x * 2\`) forbid capturing — useful to avoid accidental allocations.

\`\`\`csharp
var actions = new List<Action>();
for (int i = 0; i < 3; i++) actions.Add(() => Console.Write(i));  // prints 333 — one shared i
foreach (var x in new[] {0,1,2}) actions.Add(() => Console.Write(x)); // 012 — foreach gets a fresh variable (C# 5+)
\`\`\`

**Event**: a delegate field with restricted access.
\`\`\`csharp
public class OrderService
{
    public event EventHandler<OrderPlacedEventArgs>? OrderPlaced;

    public void Place(Order order)
    {
        // ...
        OrderPlaced?.Invoke(this, new OrderPlacedEventArgs(order.Id));  // only the owner can raise
    }
}
service.OrderPlaced += (s, e) => Console.WriteLine(e.OrderId);   // subscribers can only += / -=
\`\`\`
With a public delegate field, any caller could **invoke** it or **overwrite** all subscribers with \`=\`. The \`event\` keyword prevents both — encapsulation of the publish/subscribe pattern.

**Pitfalls**
- **Memory leaks**: a long-lived publisher keeps short-lived subscribers alive. Always unsubscribe (or use weak events).
- Exceptions in one handler stop the others.
- Events are synchronous; \`async void\` handlers are the only legitimate \`async void\`.
- For app-level decoupling, prefer explicit abstractions (MediatR notifications, message bus) over static events.`,
  },
  {
    id: 'net-throw-vs-throw-ex',
    category: 'C# & .NET',
    difficulty: 1,
    question: 'throw vs throw ex — what is the difference? What are good exception practices?',
    tldr: '`throw;` rethrows the current exception and preserves the original stack trace; `throw ex;` resets the stack trace to the current line, destroying the information about where the error really happened.',
    answer: `\`\`\`csharp
try
{
    ProcessOrder(order);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Processing failed for {OrderId}", order.Id);
    throw;        // ✔ original stack trace preserved
    // throw ex;  // ✘ stack trace now starts here — the real origin is lost
}
\`\`\`

**Other options**
- **Wrap** with context, keeping the original as \`InnerException\`:
\`\`\`csharp
catch (SqlException ex)
{
    throw new OrderRepositoryException($"Could not save order {order.Id}", ex);
}
\`\`\`
- \`ExceptionDispatchInfo.Capture(ex).Throw()\` rethrows later (e.g. on another thread) and keeps the trace — this is what \`await\` does internally.
- **Exception filters** don't unwind the stack and keep code clean:
\`\`\`csharp
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound) { return null; }
\`\`\`

**Good practices**
- Catch **specific** exceptions you can actually handle; let the rest bubble up to a **global handler** (ASP.NET Core \`IExceptionHandler\` → ProblemDetails).
- Never swallow exceptions (\`catch { }\`) — at least log, and usually rethrow.
- Don't use exceptions for control flow in hot paths (they're expensive); use \`TryParse\`, result types or validation for expected failures.
- Throw the most specific built-in type: \`ArgumentNullException.ThrowIfNull(arg)\`, \`ArgumentOutOfRangeException\`, \`InvalidOperationException\`.
- Create custom exceptions for domain errors only when callers need to catch them specifically.
- Always log with the exception object (\`LogError(ex, ...)\`), not \`ex.Message\` — you lose the stack trace and inner exceptions.
- \`finally\` / \`using\` for cleanup.`,
  },
  {
    id: 'net-string-stringbuilder',
    category: 'C# & .NET',
    difficulty: 1,
    question: 'Why is string immutable, and when should you use StringBuilder?',
    tldr: 'Strings are immutable so they are thread-safe, safe as dictionary keys, and can be interned and shared; every "modification" creates a new string, so for many concatenations in a loop use StringBuilder (or string.Join / interpolation for a few pieces).',
    answer: `**Why immutable**
- **Thread safety**: can be shared freely between threads without locks.
- **Safe keys**: a string's hash code never changes, so it works as a \`Dictionary\` key.
- **Security**: a validated path or connection string can't be changed afterwards by another reference.
- **Interning**: identical literals can share one instance (\`string.Intern\`), saving memory.

**The cost**: every \`+\`, \`Replace\`, \`Substring\`, \`ToUpper\` allocates a **new** string.
\`\`\`csharp
// ✘ O(n²) copying and n allocations
string csv = "";
foreach (var row in rows) csv += row.Name + ";";

// ✔ one growing buffer
var sb = new StringBuilder(capacity: rows.Count * 32);
foreach (var row in rows) sb.Append(row.Name).Append(';');
string result = sb.ToString();

// ✔ often even simpler
string result2 = string.Join(';', rows.Select(r => r.Name));
\`\`\`

**When to use what**
- A few concatenations in one expression: \`+\` or interpolation \`$"..."\` — the compiler optimises them (\`string.Concat\`, interpolated string handlers).
- Loops or unknown number of appends: **StringBuilder**.
- Joining a collection: \`string.Join\`.
- High-performance parsing / formatting: \`Span<char>\`, \`string.Create\`, \`stackalloc\`, \`ReadOnlySpan<char>\` slicing (no allocation, unlike \`Substring\`).

**Other string facts worth mentioning**
- Compare with \`string.Equals(a, b, StringComparison.OrdinalIgnoreCase)\` instead of \`ToLower()\` (allocation + culture bugs).
- \`string\` is a reference type but has value-like equality (\`==\` compares content).`,
  },
  {
    id: 'net-span-memory',
    category: 'C# & .NET',
    difficulty: 3,
    question: 'What is Span<T> (and Memory<T>), and what is it useful for?',
    tldr: 'Span<T> is a stack-only view over a contiguous region of memory (array, stackalloc, native memory) that lets you slice and process data without allocating; Memory<T> is its heap-storable cousin you can use across await.',
    answer: `**Span<T> / ReadOnlySpan<T>**
- A \`ref struct\`: a pointer + length over contiguous memory — managed arrays, part of an array, \`stackalloc\` buffers, native memory, or strings (\`ReadOnlySpan<char>\`).
- **Slicing is free** — no copying, no allocation.
- Because it is a \`ref struct\`, it can only live on the **stack**: it can't be a field of a class, be boxed, be captured in a lambda, or be used across \`await\` / in iterators.

\`\`\`csharp
// parse "2026-11-10" without Substring allocations
static DateOnly ParseDate(ReadOnlySpan<char> s) =>
    new(int.Parse(s[..4]), int.Parse(s.Slice(5, 2)), int.Parse(s[8..]));

// temporary buffer on the stack instead of the heap
Span<byte> buffer = stackalloc byte[256];
int written = Encoding.UTF8.GetBytes("hello", buffer);

// fast checks on parts of a string
ReadOnlySpan<char> header = line.AsSpan();
if (header.StartsWith("Bearer ", StringComparison.Ordinal)) { var token = header[7..]; }
\`\`\`

**Memory<T> / ReadOnlyMemory<T>**
- A regular struct wrapper over the same kinds of memory that **can** be stored in fields and used across \`await\`.
- Call \`.Span\` to get a Span when you actually process the data.
\`\`\`csharp
async Task ProcessAsync(ReadOnlyMemory<byte> data, Stream output)
{
    await output.WriteAsync(data);          // Memory works with async APIs
}
\`\`\`

**Where it's used**: parsers, serializers (System.Text.Json), networking (Kestrel, Pipelines), \`int.Parse(ReadOnlySpan<char>)\`, \`string.Create\`, \`ArrayPool<T>\` buffers.

**Interview framing**: "In typical business code I rarely need it directly, but I know the framework uses it heavily for performance. I'd reach for it in hot paths — parsing large files or protocol messages — after measuring with BenchmarkDotNet."`,
  },
  {
    id: 'net-interface-vs-abstract',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'Interface vs abstract class — what is the difference and when do you use each?',
    tldr: 'An interface defines a contract a type can implement (many interfaces per class, no state); an abstract class is a partial base implementation with shared state and code (single inheritance). Use interfaces for capabilities and abstractions; abstract classes to share implementation in a family of closely related types.',
    answer: `| | Interface | Abstract class |
|---|---|---|
| Multiple inheritance | a class can implement many | only one base class |
| Instance state (fields) | no | yes |
| Constructors | no | yes (protected) |
| Access modifiers | members public by default | any (protected, private...) |
| Default implementation | yes since C# 8 (default interface methods) | yes |
| Static members | static abstract/virtual since C# 11 | yes |
| Works for structs | yes | no |

\`\`\`csharp
public interface INotificationSender            // contract / capability
{
    Task SendAsync(string to, string message, CancellationToken ct);
}

public abstract class NotificationSenderBase : INotificationSender   // shared implementation
{
    private readonly ILogger _logger;
    protected NotificationSenderBase(ILogger logger) => _logger = logger;

    public async Task SendAsync(string to, string message, CancellationToken ct)   // template method
    {
        ArgumentException.ThrowIfNullOrEmpty(to);
        _logger.LogInformation("Sending to {Recipient}", to);
        await SendCoreAsync(to, message, ct);
    }

    protected abstract Task SendCoreAsync(string to, string message, CancellationToken ct);
}

public sealed class EmailSender(ILogger<EmailSender> logger) : NotificationSenderBase(logger)
{
    protected override Task SendCoreAsync(string to, string message, CancellationToken ct) => /* SMTP */ Task.CompletedTask;
}
\`\`\`

**Use an interface when**
- You define a **contract** for dependency injection, testing (mocks/fakes) and Dependency Inversion.
- Unrelated types share a capability (\`IComparable\`, \`IDisposable\`).
- You need multiple "inheritance" of behaviour contracts.

**Use an abstract class when**
- Several closely related types share **state and code** (Template Method pattern, base handlers).
- You want to control construction and provide protected helpers.
- You expect to add members later without breaking implementers (adding an abstract member breaks them; adding a virtual one doesn't).

**Senior nuance**: prefer **interfaces + composition** in application code; deep abstract hierarchies become rigid. Default interface methods exist mainly to evolve public library interfaces without breaking implementers — not as a replacement for abstract classes.`,
    followUps: [
      { q: 'What are default interface methods for?', a: 'Adding a member to a published interface without breaking existing implementations (e.g. a new method with a default body). They cannot hold instance state, and the method is only callable through the interface type.' },
    ],
  },
  {
    id: 'net-const-readonly-static',
    category: 'C# & .NET',
    difficulty: 1,
    question: 'const vs readonly vs static readonly vs static — what is the difference?',
    tldr: 'const is a compile-time constant baked into every caller; readonly is assigned once at runtime (per instance) in the declaration or constructor; static readonly is a runtime constant shared by the type; static means "belongs to the type, not an instance" and can still change.',
    answer: `**const**
- Value known at **compile time**; only primitives, \`string\`, enums, or \`null\`.
- Implicitly static. Can't be changed, ever.
- **Copied (inlined) into calling assemblies** at compile time. If library A changes \`const int MaxItems = 10\` to 20 and app B isn't recompiled, B still uses 10 — a versioning trap for public constants.

**readonly (instance field)**
- Assigned in the declaration or in a **constructor**; immutable afterwards.
- Value can be computed at runtime and differ per instance.
- For reference types only the **reference** is readonly — the object (e.g. a \`List\`) can still be mutated.

**static readonly**
- Assigned once, in the declaration or the **static constructor**; shared by all instances.
- Use for values that are constant but not compile-time constants, or for public "constants" that may change between versions.

**static**
- Belongs to the **type**, not to an instance. A plain \`static\` field is mutable global state — beware of thread safety and testability.

\`\`\`csharp
public class PricingService
{
    public const int MaxDiscountPercent = 50;                          // compile-time, inlined
    public static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(5); // runtime, shared
    private static readonly HashSet<string> Vip = new() { "gold" };    // reference readonly, set mutable!
    private static int _instances;                                     // mutable shared state — needs Interlocked
    private readonly ILogger _logger;                                  // per instance, set in ctor
    private readonly DateTime _createdAt = DateTime.UtcNow;            // runtime value per instance

    public PricingService(ILogger<PricingService> logger)
    {
        _logger = logger;
        Interlocked.Increment(ref _instances);
    }
}
\`\`\`

**Related modifiers**
- \`init\` accessor: property settable only during object initialisation (\`new X { Name = "a" }\`).
- \`readonly struct\` / \`readonly\` members: guarantee no mutation, avoid defensive copies.
- \`required\` (C# 11): caller must set the property in the initializer.
- For truly immutable collections: \`IReadOnlyList<T>\`, \`ImmutableArray<T>\`, \`FrozenSet<T>\` (.NET 8).`,
  },
  {
    id: 'net-generics-variance',
    category: 'C# & .NET',
    difficulty: 3,
    question: 'Generics and constraints (where T : …). What are covariance and contravariance?',
    tldr: 'Generics give type-safe reusable code without boxing; constraints tell the compiler what T can do. Covariance (out T) lets you use a more derived type where a base is expected for outputs (IEnumerable<string> as IEnumerable<object>); contravariance (in T) allows the opposite for inputs (Action<object> as Action<string>).',
    answer: `**Constraints**
\`\`\`csharp
public class Repository<T> where T : class, IEntity, new() { }   // reference type, implements IEntity, has parameterless ctor
public T Max<T>(T a, T b) where T : IComparable<T> => a.CompareTo(b) >= 0 ? a : b;
// others: where T : struct, notnull, unmanaged, Enum, Delegate, BaseClass, U (another type param)
// C# 11: static abstract members → generic math
public static T Sum<T>(IEnumerable<T> xs) where T : INumber<T> => xs.Aggregate(T.Zero, (a, b) => a + b);
\`\`\`
Benefits: compile-time type safety, no casts, **no boxing** for value types (the JIT generates specialised code per value type).

**Variance** (only on generic **interfaces and delegates**, only for **reference types**)
- **Covariance** — \`out T\`: T appears only in output positions. A producer of \`string\` can be used as a producer of \`object\`.
\`\`\`csharp
IEnumerable<string> names = new List<string> { "a" };
IEnumerable<object> objects = names;          // ✔ IEnumerable<out T>
// List<object> list = new List<string>();     // ✘ List<T> is invariant (you could Add(42) into a List<string>)
\`\`\`
- **Contravariance** — \`in T\`: T appears only in input positions. A consumer of \`object\` can be used where a consumer of \`string\` is needed.
\`\`\`csharp
Action<object> logAnything = o => Console.WriteLine(o);
Action<string> logString = logAnything;       // ✔ Action<in T>
IComparer<Animal> byWeight = ...;
IComparer<Dog> dogComparer = byWeight;        // ✔ IComparer<in T>
\`\`\`
- **Invariant**: \`List<T>\`, \`IList<T>\` — T is both read and written, so no variance.
- \`Func<in T, out TResult>\` combines both.

**Defining your own**
\`\`\`csharp
public interface IHandler<in TMessage> { Task Handle(TMessage msg); }   // consumer → in
public interface IProvider<out T> { T Get(); }                          // producer → out
\`\`\`

**Gotcha**: arrays are covariant (\`object[] a = new string[1];\`) — legacy design that can throw \`ArrayTypeMismatchException\` at runtime when you write \`a[0] = 1\`.`,
  },
  {
    id: 'net-nullable-pattern-matching',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'What are nullable reference types and pattern matching, and how do you use them?',
    tldr: 'Nullable reference types (C# 8) make nullability part of the type annotations (string vs string?) with compiler warnings for possible null dereferences; pattern matching lets you test and deconstruct values by type, shape and value in is-expressions and switch expressions.',
    answer: `**Nullable reference types (NRT)**
- Enabled with \`<Nullable>enable</Nullable>\` (default in new projects).
- \`string\` = should never be null; \`string?\` = may be null. The compiler warns when you dereference a maybe-null value or assign null to a non-nullable.
- It's **static analysis only** — no runtime checks. Data from outside (JSON, DB, reflection) can still be null, so validate at boundaries.
- Tools: \`?.\`, \`??\`, \`??=\`, \`ArgumentNullException.ThrowIfNull\`, attributes like \`[NotNullWhen(true)]\`, \`[MemberNotNull]\`. The \`!\` (null-forgiving) operator silences warnings — use sparingly.
- Treat warnings as errors in new code (\`<WarningsAsErrors>nullable</WarningsAsErrors>\`).

\`\`\`csharp
public string GetDisplayName(User? user) => user?.Nickname ?? user?.Email ?? "anonymous";

public bool TryFind(int id, [NotNullWhen(true)] out Order? order) { /* ... */ }
\`\`\`

**Pattern matching**
\`\`\`csharp
// type + property patterns
if (shape is Circle { Radius: > 10 } big) Console.WriteLine(big.Radius);

// switch expression with relational, logical and property patterns
decimal Discount(Customer c) => c switch
{
    { IsVip: true, Orders: > 100 } => 0.20m,
    { IsVip: true }                => 0.10m,
    { Country: "PL" or "DE" }      => 0.05m,
    null                           => throw new ArgumentNullException(nameof(c)),
    _                              => 0m,
};

// positional / tuple patterns
string Classify(int status, bool retry) => (status, retry) switch
{
    (>= 500, true) => "retry",
    (>= 500, _)    => "fail",
    (404, _)       => "not found",
    _              => "ok",
};

// list patterns (C# 11)
if (args is [var first, .., var last]) { }

// null checks that can't be fooled by overloaded ==
if (obj is null) { }   if (obj is not null) { }
\`\`\`

**Why seniors like it**: exhaustive \`switch\` expressions on closed hierarchies (records + pattern matching) replace long if/else chains and make illegal states visible.`,
  },
  {
    id: 'net-whats-new',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'What has changed in recent .NET (8–10) and C# (12–14) versions that you actually use?',
    tldr: 'Pick a few features you really use and say why: primary constructors and collection expressions (C# 12), keyed DI services, TimeProvider, FrozenDictionary and IExceptionHandler (.NET 8), HybridCache and the new Lock type (.NET 9), field-backed properties and extension members (C# 14 / .NET 10 LTS).',
    answer: `Interviewers want to see that you keep up — and that you can say **why** a feature matters. Mention 3–5 you've used, not a list you memorised.

**.NET 8 (LTS) / C# 12**
- **Primary constructors** for classes — less DI boilerplate:
\`\`\`csharp
public class OrderService(IOrderRepository repo, ILogger<OrderService> logger)
{
    public Task<Order?> Get(int id) => repo.FindAsync(id);
}
\`\`\`
- **Collection expressions**: \`int[] a = [1, 2, 3]; List<string> b = [..a.Select(x => x.ToString()), "x"];\`
- **Keyed DI services**: \`services.AddKeyedSingleton<IStorage, BlobStorage>("blob")\` + \`[FromKeyedServices("blob")]\`.
- **TimeProvider** abstraction for testable time (\`FakeTimeProvider\` in tests).
- \`IExceptionHandler\` for global exception handling, built-in **rate limiting**, **output caching**, Native AOT for minimal APIs, \`FrozenDictionary/FrozenSet\`, \`[LoggerMessage]\` source generators, Identity API endpoints.
- \`Microsoft.Extensions.Http.Resilience\` (Polly v8-based standard resilience handler).

**.NET 9 / C# 13**
- **HybridCache** — in-memory + distributed cache with stampede protection.
- New **\`System.Threading.Lock\`** type (\`lock\` on it uses a faster, dedicated primitive).
- \`params\` collections (\`params ReadOnlySpan<T>\`), LINQ \`CountBy\` / \`AggregateBy\` / \`Index\`.
- Built-in OpenAPI document generation (\`Microsoft.AspNetCore.OpenApi\`) replacing Swashbuckle in templates.

**.NET 10 (LTS, Nov 2025) / C# 14**
- \`field\` keyword in property accessors (no manual backing field):
\`\`\`csharp
public string Name { get; set => field = value?.Trim() ?? throw new ArgumentNullException(); }
\`\`\`
- **Extension members** (extension properties and static extension members), null-conditional assignment (\`order?.Status = Shipped;\`).
- Continued performance work (JIT, GC), file-based apps (\`dotnet run app.cs\`), Minimal API validation.

**How to answer**: "We run .NET 8, I use primary constructors and keyed services daily, TimeProvider made our time-based tests deterministic, and IExceptionHandler + ProblemDetails replaced our custom middleware. I'm following .NET 10 since it's the next LTS — we'll plan the upgrade around it." Pair it with how you **upgrade** (LTS cadence, analyzers, upgrade assistant, tests).`,
  },
  {
    id: 'net-ref-out-in',
    category: 'C# & .NET',
    difficulty: 1,
    question: 'ref vs out vs in (and params): what is the difference?',
    tldr: 'All three pass an argument by reference: ref must be initialised and may be changed, out need not be initialised but must be assigned by the method, in is read-only by reference (avoids copying large structs); params lets callers pass a variable number of arguments.',
    answer: `By default C# passes arguments **by value**: a copy of a value type, or a copy of the *reference* for a reference type (you can mutate the object, but reassigning the parameter doesn't affect the caller).

\`\`\`csharp
void Increment(ref int x) => x++;                       // caller's variable changes
bool TryParse(string s, out int value) => int.TryParse(s, out value);
double Length(in Vector3 v) => Math.Sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z);   // no copy, no writes
int Sum(params int[] xs) => xs.Sum();                  // Sum(1, 2, 3)

int n = 1; Increment(ref n);                            // n == 2
if (int.TryParse("42", out var parsed)) { /* ... */ }
\`\`\`

| | must be initialised by caller | must be assigned by method | method can write |
|---|---|---|---|
| \`ref\` | yes | no | yes |
| \`out\` | no | yes | yes |
| \`in\` | yes | no | **no** |

**When**
- \`out\`: the **Try-pattern** (\`TryParse\`, \`TryGetValue\`) — or return a tuple / result type instead.
- \`ref\`: rare in app code; performance-sensitive code, swapping, \`ref\` returns and \`ref struct\` (Span).
- \`in\`: large **readonly structs** on hot paths (on a non-readonly struct the compiler may make defensive copies).
- \`params\`: convenience APIs; C# 13 allows \`params Span<T>\` / collections, avoiding the array allocation.

**Limits**: lambdas can't capture \`ref/out/in\` parameters, and async methods / iterators can't declare them.`,
  },
  {
    id: 'net-virtual-override-new',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'virtual, override, new (method hiding), abstract and sealed: how do they differ?',
    tldr: 'virtual allows a derived class to override a member and the call is dispatched by the runtime type; override replaces it; new only hides the base member, so the version called depends on the compile-time type; abstract forces an override; sealed stops further overriding/inheritance.',
    answer: `\`\`\`csharp
class Animal
{
    public virtual string Speak() => "...";
    public string Name() => "animal";
}
class Dog : Animal
{
    public override string Speak() => "Woof";      // polymorphism
    public new string Name() => "dog";             // hiding, no polymorphism
}

Animal a = new Dog();
a.Speak();         // "Woof"   → runtime type decides (virtual dispatch)
a.Name();          // "animal" → compile-time type decides (hiding)
((Dog)a).Name();   // "dog"
\`\`\`

- **virtual**: may be overridden; the call is dispatched through the vtable based on the **runtime** type. Methods are non-virtual by default in C# (unlike Java).
- **override**: provides the new implementation; can call \`base.Speak()\`.
- **new**: declares an unrelated member with the same name. Surprising behaviour → avoid; the compiler warns if you hide without \`new\`.
- **abstract**: no implementation, must be overridden; the class must be abstract too.
- **sealed**: a \`sealed class\` can't be inherited; \`sealed override\` stops further overriding. Sealing classes by default is good practice (clear intent, small JIT devirtualisation gains).

**Related**: default interface methods (C# 8), abstract class vs interface (separate question), and preferring composition over deep inheritance.`,
  },
  {
    id: 'net-equals-gethashcode',
    category: 'C# & .NET',
    difficulty: 2,
    question: '== vs Equals vs ReferenceEquals. Why must you override GetHashCode together with Equals?',
    tldr: '== is an operator (reference equality for classes unless overloaded, value equality for primitives/strings/records); Equals is virtual and can define value equality; ReferenceEquals always compares references. Hash-based collections use GetHashCode first, so equal objects must return equal hash codes.',
    answer: `\`\`\`csharp
string a = "hi", b = new string("hi".ToCharArray());
a == b;                        // true  (string overloads ==)
object.ReferenceEquals(a, b);  // false (two instances)

var p1 = new Point(1, 2); var p2 = new Point(1, 2);   // a class without overrides
p1 == p2;        // false — reference equality
p1.Equals(p2);   // false — default Equals is reference equality too
// record Point(int X, int Y) → both true (compiler-generated value equality)
\`\`\`

**The rules**
- \`==\` is resolved at **compile time** (static types); \`Equals\` is virtual (runtime type).
- Value types: the default \`Equals\` compares fields (possibly via reflection, slow) → override, use \`record struct\`, and implement \`IEquatable<T>\` to avoid boxing.
- If you override \`Equals\`, override **\`GetHashCode\`**: \`Dictionary\`/\`HashSet\` first find the bucket by hash, then call \`Equals\`. Equal objects with different hashes → lookups fail, duplicates in sets.
- A hash code must not change while the object is in a collection → base it on immutable fields.

\`\`\`csharp
public sealed class Money(decimal amount, string currency) : IEquatable<Money>
{
    public decimal Amount { get; } = amount;
    public string Currency { get; } = currency;
    public bool Equals(Money? o) => o is not null && Amount == o.Amount && Currency == o.Currency;
    public override bool Equals(object? o) => Equals(o as Money);
    public override int GetHashCode() => HashCode.Combine(Amount, Currency);
}
\`\`\`
**Simplest today**: use a \`record\` for value semantics.

**Strings**: compare with \`string.Equals(a, b, StringComparison.OrdinalIgnoreCase)\`, not \`ToLower() ==\` (allocations, culture bugs).`,
  },
  {
    id: 'net-access-modifiers',
    category: 'C# & .NET',
    difficulty: 1,
    question: 'What access modifiers exist in C#? What are the defaults?',
    tldr: 'public, private, protected, internal, protected internal (protected OR same assembly), private protected (derived AND same assembly), and file (C# 11, one source file); members default to private, top-level types to internal.',
    answer: `| Modifier | Accessible from |
|---|---|
| \`public\` | everywhere |
| \`private\` | the containing type only (**default for members**) |
| \`protected\` | the type and derived types |
| \`internal\` | the same assembly (**default for top-level types**) |
| \`protected internal\` | same assembly **or** derived types |
| \`private protected\` | derived types **in the same assembly** |
| \`file\` (C# 11) | the same source file (handy for source generators) |

**In practice**
- Keep things as **private / internal** as possible; a smaller public surface = freedom to refactor.
- In Clean Architecture make Infrastructure implementations \`internal\` and expose only DI registration extension methods.
- \`[InternalsVisibleTo("MyApp.Tests")]\` to test internal types (or test through the public API).
- \`internal sealed\` by default for classes is a sensible team convention.`,
  },
  {
    id: 'net-extension-yield',
    category: 'C# & .NET',
    difficulty: 2,
    question: 'How do extension methods and yield return (iterators) work?',
    tldr: 'Extension methods are static methods in a static class with a this-parameter, called like instance methods (that is how LINQ works); yield return makes the compiler generate a lazy iterator state machine, so values are produced one at a time during enumeration.',
    answer: `**Extension methods**
\`\`\`csharp
public static class StringExtensions
{
    public static bool IsBlank(this string? s) => string.IsNullOrWhiteSpace(s);
}
if (input.IsBlank()) { }      // compiled to StringExtensions.IsBlank(input)
\`\`\`
- Syntactic sugar for a static call: no access to private members, resolved at compile time (the namespace must be imported), an instance method with the same signature wins.
- Great for fluent APIs and DI registration (\`services.AddInfrastructure(config)\`); don't use them to hide business logic or I/O.
- C# 14 adds **extension members** (\`extension(string s) { ... }\` blocks, including properties).

**yield return**
\`\`\`csharp
static IEnumerable<int> Evens(int max)
{
    for (int i = 0; i <= max; i += 2)
    {
        Console.WriteLine("producing " + i);
        yield return i;               // pauses here until the next MoveNext()
    }
}

foreach (var x in Evens(10).Take(2)) Console.WriteLine(x);   // only 0 and 2 are produced
\`\`\`
- The compiler generates a class implementing \`IEnumerable/IEnumerator\` with a state machine (a similar idea to async/await).
- **Lazy / deferred**: nothing runs until enumeration; re-enumerating runs it again; argument validation inside the iterator is deferred too (validate in a wrapper method).
- \`yield break\` ends the sequence. Useful for streaming large data, infinite sequences, pipelines.
- **Async version**: \`IAsyncEnumerable<T>\` with \`yield return\` in an \`async\` method, consumed with \`await foreach\`.`,
  },
  {
    id: 'net-static-class-ctor',
    category: 'C# & .NET',
    difficulty: 1,
    question: 'What is a static class and a static constructor? What are the risks of static state?',
    tldr: 'A static class cannot be instantiated and holds only static members (helpers, extension methods); a static constructor runs once, lazily, before first use of the type and is thread-safe. Mutable static state is shared by all requests and threads, hard to test, and a common source of bugs and leaks.',
    answer: `\`\`\`csharp
public static class Slug
{
    private static readonly Regex Invalid;
    static Slug() => Invalid = new Regex("[^a-z0-9-]", RegexOptions.Compiled);   // runs once, thread-safe
    public static string From(string s) => Invalid.Replace(s.ToLowerInvariant().Replace(' ', '-'), "");
}
\`\`\`

**Static class**: sealed and abstract under the hood, no instances, no inheritance, no interfaces. Good for stateless helpers and extension methods.

**Static constructor**: no parameters or access modifier, called automatically by the runtime once per type, before the first static member access or instance creation. If it throws, the type is unusable (\`TypeInitializationException\`) for the rest of the process.

**Risks of mutable static state**
- Shared across **all requests and threads** in ASP.NET Core → race conditions without synchronisation.
- Hidden dependency: can't be replaced in tests, tests interfere with each other.
- Memory leaks: static collections and events keep objects alive forever.
- \`DateTime.Now\`, \`File.*\`, static config accessors inside business logic hurt testability.

**Alternative**: register a **singleton** in DI — same "one instance" effect, but injectable, replaceable in tests, with a clear lifetime.`,
  },
]);
