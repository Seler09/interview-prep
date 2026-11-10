/*
  SENIOR: JS / TS / NODE, FRONTEND, CONCURRENCY
  Format: see the comment at the top of questions.js
*/
addQuestions('senior', [
  // =====================================================================
  // JS / TS / NODE (SENIOR)
  // =====================================================================
  {
    id: 'node-event-loop-phases',
    category: 'JS / TS / Node (Senior)',
    difficulty: 3,
    question: 'How does the Node.js event loop work (phases, libuv, thread pool)?',
    tldr: 'Node runs JavaScript on one thread on top of libuv, whose event loop cycles through phases (timers, poll, check…); network I/O is non-blocking via the OS, while file system, DNS lookup, crypto and zlib use a small thread pool, and process.nextTick and promise microtasks run between every callback.',
    answer: `**Architecture**: Node = V8 (runs JS) + **libuv** (event loop, async I/O) + bindings.
- **Network I/O** uses the OS's non-blocking mechanisms (epoll, kqueue, IOCP); no threads needed.
- **Thread pool** (default **4** threads, \`UV_THREADPOOL_SIZE\`, max 1024): file system operations, \`dns.lookup\`, \`crypto.pbkdf2/scrypt/randomBytes\`, \`zlib\`. If you saturate it (e.g. many bcrypt hashes), unrelated file reads queue up too.

**Event loop phases** (each has a FIFO queue of callbacks):
1. **timers**: expired \`setTimeout\` / \`setInterval\` callbacks.
2. **pending callbacks**: some deferred system errors (e.g. TCP errors).
3. idle / prepare (internal).
4. **poll**: retrieve new I/O events and run their callbacks; may block here waiting for I/O if nothing else is scheduled.
5. **check**: \`setImmediate\` callbacks.
6. **close callbacks**: e.g. \`socket.on('close')\`.

**Microtasks**: after **each** callback, Node drains the \`process.nextTick\` queue first, then the promise microtask queue.

\`\`\`js
const fs = require('fs');
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  process.nextTick(() => console.log('nextTick'));
  Promise.resolve().then(() => console.log('promise'));
});
// nextTick, promise, immediate, timeout
// (inside an I/O callback, check runs before the next timers phase)
\`\`\`

**Practical consequences**
- **CPU-bound work blocks everything**: JSON-parsing a 50 MB payload, sync crypto, heavy loops or regex backtracking freeze all requests. Solutions: \`worker_threads\`, a separate service, chunking work with \`setImmediate\`, streaming parsers.
- Recursive \`process.nextTick\` can **starve I/O**.
- Avoid \`*Sync\` APIs in request paths.
- Monitor **event loop lag / utilisation**:
\`\`\`js
const { monitorEventLoopDelay } = require('perf_hooks');
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();
setInterval(() => console.log('p99 loop delay ms', h.percentile(99) / 1e6), 10_000);
\`\`\`
- Scale across cores with multiple processes (cluster module, PM2, or more containers).`,
    followUps: [
      { q: 'setImmediate vs setTimeout(fn, 0): which runs first?', a: 'In the main module the order is non-deterministic (depends on process performance and timer granularity). Inside an I/O callback, setImmediate always runs first because the check phase comes right after poll.' },
      { q: 'When would you increase UV_THREADPOOL_SIZE?', a: 'When profiling shows the pool is the bottleneck: heavy fs usage, many concurrent dns.lookup calls, or CPU-heavy crypto/zlib. Set it before the pool is first used (at startup) and size it relative to CPU cores; it does not help network-bound work.' },
    ],
  },
  {
    id: 'node-memory-leaks',
    category: 'JS / TS / Node (Senior)',
    difficulty: 3,
    question: 'How do you find a memory leak in a Node.js or browser application?',
    tldr: 'Confirm memory grows across GC cycles, take heap snapshots at intervals and compare them, follow the retainer chain of objects that keep accumulating, then fix the reference (unbounded caches, listeners, timers, closures, detached DOM).',
    answer: `**Typical causes**
- **Unbounded caches or maps**: \`const cache = {}\` that only grows.
- **Event listeners** never removed (\`emitter.on\` per request, \`window.addEventListener\` in components without cleanup).
- **Timers** (\`setInterval\`) still referencing big objects.
- **Closures** capturing large scopes.
- **Detached DOM nodes** kept in JS arrays or maps after removal from the page.
- Global variables, accidental module-level state, request objects stored in long-lived structures.
- Unconsumed streams or promises that never settle.

**Process**
1. **Confirm**: heap usage after GC keeps rising over time (a sawtooth with a rising baseline), eventually OOM kills or GC thrashing. Metrics: \`process.memoryUsage().heapUsed\`, RSS, container memory.
2. **Reproduce** under load locally or in staging (autocannon or k6 against the suspected endpoint).
3. **Heap snapshots**: take one, apply load, force GC, take another, then a third.
\`\`\`bash
node --inspect app.js            # open chrome://inspect → Memory tab → Heap snapshot
# or programmatically, e.g. on a signal:
node -e "process.on('SIGUSR2', () => require('v8').writeHeapSnapshot())"
\`\`\`
4. **Compare** snapshots (Comparison view): which constructors grow in count and retained size?
5. **Retainers**: inspect the retaining path of a growing object to see *who* holds the reference (e.g. \`Map\` in \`cache.js\` → closure → ...).
6. **Fix and verify** with the same load test.

**Fix patterns**
\`\`\`js
// bounded cache instead of a plain object
const LRU = require('lru-cache');
const cache = new LRU({ max: 10_000, ttl: 60_000 });

// metadata keyed by objects without preventing GC
const meta = new WeakMap();

// always clean up listeners
const ac = new AbortController();
window.addEventListener('resize', onResize, { signal: ac.signal });
// later: ac.abort() removes it

// React effect cleanup
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);
\`\`\`

**Other tools**: \`--heapsnapshot-near-heap-limit\`, clinic.js (heapprofiler), allocation sampling, Chrome's Performance Monitor and "Detached elements" in the browser. Also know \`--max-old-space-size\` and container memory limits: Node may not see the cgroup limit in older versions, so set it explicitly.`,
  },
  {
    id: 'node-streams',
    category: 'JS / TS / Node (Senior)',
    difficulty: 2,
    question: 'Explain Node.js streams and backpressure.',
    tldr: 'Streams process data in chunks instead of loading everything into memory; backpressure is the mechanism that slows a fast producer when the consumer cannot keep up, and stream.pipeline() handles it plus error propagation and cleanup for you.',
    answer: `**Why streams**: exporting a 5 GB CSV, proxying uploads, or transforming logs without holding everything in memory. Memory stays roughly constant and the first bytes go out sooner.

**Types**
- **Readable** (\`fs.createReadStream\`, HTTP request on the server, \`process.stdin\`).
- **Writable** (\`fs.createWriteStream\`, HTTP response, \`process.stdout\`).
- **Duplex** (TCP socket) and **Transform** (zlib, CSV parser, your own transformations).

**Backpressure**
- Each writable has an internal buffer with a \`highWaterMark\`. When it is full, \`write()\` returns **false** and the producer must **stop** until the \`'drain'\` event.
- Ignoring the return value means the buffer grows without limit and memory explodes (a classic bug in hand-written loops).

\`\`\`js
// manual: respect write() return value
async function writeMany(ws, rows) {
  for (const row of rows) {
    if (!ws.write(row + '\\n')) await new Promise(r => ws.once('drain', r));
  }
  ws.end();
}
\`\`\`

**Use \`pipeline\`**: it wires backpressure, forwards errors from any stage and destroys all streams on failure (\`.pipe()\` does **not** propagate errors and can leak file descriptors).
\`\`\`js
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const zlib = require('node:zlib');
const fs = require('node:fs');

const toUpper = new Transform({
  transform(chunk, _enc, cb) { cb(null, chunk.toString().toUpperCase()); },
});

await pipeline(
  fs.createReadStream('input.log'),
  toUpper,
  zlib.createGzip(),
  fs.createWriteStream('output.log.gz'),
);
\`\`\`

**Modern conveniences**
- Readable streams are **async iterable**: \`for await (const chunk of readable) { ... }\`, which also respects backpressure.
- \`Readable.from(asyncGenerator())\` turns a generator into a stream.
- Web Streams (\`ReadableStream\`) are also available in Node and are what \`fetch\` returns.

**Typical use in an API**: stream a DB cursor → CSV transform → gzip → HTTP response, so a huge export uses a few MB of memory.`,
  },
  {
    id: 'ts-advanced-types',
    category: 'JS / TS / Node (Senior)',
    difficulty: 3,
    question: 'Advanced TypeScript: generics, conditional types, mapped types, infer. Show examples.',
    tldr: 'Generics parameterise types, mapped types transform every property of a type, conditional types choose types based on conditions (with infer extracting parts of a type), and discriminated unions with never give exhaustiveness checks. Types are erased at runtime, so external data still needs validation.',
    answer: `**Generics with constraints**
\`\`\`ts
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}
const u = pick({ id: 1, name: 'Ann', email: 'a@x.io' }, ['id', 'name']); // { id: number; name: string }
\`\`\`

**Mapped types (+ key remapping)**
\`\`\`ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Getters<T> = { [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K] };
type G = Getters<{ name: string }>;   // { getName: () => string }
\`\`\`

**Conditional types and infer**
\`\`\`ts
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;
type Fn = (id: number, opts: { force: boolean }) => Promise<string>;
type Params = Parameters<Fn>;            // [number, { force: boolean }]
type Result = UnwrapPromise<ReturnType<Fn>>; // string
\`\`\`
Conditional types **distribute** over unions: \`NonNullable<string | null>\` → \`string\`.

**Discriminated unions + exhaustiveness**
\`\`\`ts
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type Shape = { kind: 'circle'; r: number } | { kind: 'rect'; w: number; h: number };
function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'rect':   return s.w * s.h;
    default: {
      const unreachable: never = s;   // compile error if a new kind is added and not handled
      throw new Error(\`Unhandled shape: \${JSON.stringify(unreachable)}\`);
    }
  }
}
\`\`\`

**Branded types** (prevent mixing IDs)
\`\`\`ts
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };
const asUserId = (s: string) => s as UserId;
function getUser(id: UserId) { /* ... */ }
// getUser(orderId) → compile error
\`\`\`

**Other things a senior should know**
- **Structural typing**: compatibility is based on shape, not names.
- \`unknown\` vs \`any\`: \`unknown\` forces you to narrow before use.
- Type guards (\`x is User\`), assertion functions (\`asserts x is User\`).
- \`satisfies\`: check against a type while keeping the precise inferred type.
- \`as const\` for literal types; template literal types.
- **Types disappear at runtime**: validate external input (HTTP bodies, env vars, JSON) with zod or valibot and **infer** the TS type from the schema:
\`\`\`ts
import { z } from 'zod';
const CreateUser = z.object({ email: z.string().email(), age: z.number().int().min(18) });
type CreateUser = z.infer<typeof CreateUser>;
const input = CreateUser.parse(req.body);   // throws on invalid data
\`\`\``,
  },
  {
    id: 'js-prototype',
    category: 'JS / TS / Node (Senior)',
    difficulty: 2,
    question: 'How does prototypal inheritance work, and what are classes in JavaScript?',
    tldr: 'Every object has a hidden [[Prototype]] link; property lookups walk this chain until found or null. Classes are mostly syntax over constructor functions and prototypes, with a few real additions such as private fields.',
    answer: `**The prototype chain**
- Every object has an internal \`[[Prototype]]\` (accessible via \`Object.getPrototypeOf\` or the legacy \`__proto__\`).
- Reading \`obj.x\`: if \`obj\` does not have its own \`x\`, JS looks in its prototype, then the prototype's prototype, up to \`Object.prototype\` and finally \`null\`.
- **Writing** \`obj.x = 1\` creates an own property on \`obj\` (shadowing), unless a setter exists up the chain.

\`\`\`js
const animal = { speak() { return \`\${this.name} makes a sound\`; } };
const dog = Object.create(animal);      // dog's prototype is animal
dog.name = 'Rex';
dog.speak();                            // "Rex makes a sound": found on the prototype
Object.getPrototypeOf(dog) === animal;  // true
\`\`\`

**Constructor functions (pre-ES2015)**
\`\`\`js
function User(name) { this.name = name; }
User.prototype.greet = function () { return 'Hi ' + this.name; };
const u = new User('Ann');   // new: create object, link to User.prototype, call with this, return it
\`\`\`

**Classes**: the same mechanism with nicer syntax:
\`\`\`js
class User {
  #password;                         // truly private field (not on the prototype, not accessible outside)
  static count = 0;
  constructor(name, password) { this.name = name; this.#password = password; User.count++; }
  greet() { return \`Hi \${this.name}\`; }       // lives on User.prototype, shared by instances
  check(p) { return p === this.#password; }
}
class Admin extends User {
  greet() { return super.greet() + ' (admin)'; }
}
typeof User; // "function"
\`\`\`
Differences from plain functions: classes always run in strict mode, cannot be called without \`new\`, are not hoisted like function declarations (TDZ), methods are non-enumerable, and they support \`#private\` fields and static blocks.

**Related facts**
- \`instanceof\` checks whether \`Ctor.prototype\` appears in the object's prototype chain.
- Methods on the prototype are shared (memory-efficient); arrow-function class fields are created **per instance** (handy for \`this\` binding, but more memory).
- Modifying built-in prototypes (\`Array.prototype.foo = ...\`) is a bad idea: collisions and future-compatibility problems.
- Long prototype chains or changing an object's prototype at runtime (\`Object.setPrototypeOf\`) hurt engine optimisations.`,
  },
  {
    id: 'js-weakmap',
    category: 'JS / TS / Node (Senior)',
    difficulty: 2,
    question: 'Map vs WeakMap, Set vs WeakSet: when do you need weak references?',
    tldr: 'WeakMap and WeakSet hold their object keys weakly, so an entry disappears when nothing else references the key, which lets you attach metadata or caches to objects without causing memory leaks; the trade-off is no iteration and no size.',
    answer: `**Map / Set**: strong references. As long as the Map is alive, its keys and values are alive, even if nothing else uses them. Any key type, iterable, \`size\` available.

**WeakMap / WeakSet**
- Keys must be **objects** (or non-registered symbols).
- Keys are held **weakly**: if the key object is not reachable elsewhere, it can be garbage-collected and the entry vanishes.
- **Not iterable**, no \`size\`, no \`clear\`. Otherwise you could observe GC timing.

**Use cases**
\`\`\`js
// 1. Cache computed data per object without leaking
const layoutCache = new WeakMap();
function measure(el) {
  if (!layoutCache.has(el)) layoutCache.set(el, el.getBoundingClientRect());
  return layoutCache.get(el);          // entry dies with the DOM element
}

// 2. Private data per instance (pre-#private pattern)
const priv = new WeakMap();
class Counter {
  constructor() { priv.set(this, { count: 0 }); }
  inc() { return ++priv.get(this).count; }
}

// 3. Mark objects as visited (e.g. deep clone / cycle detection)
function deepClone(obj, seen = new WeakMap()) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (seen.has(obj)) return seen.get(obj);   // handles circular references
  const copy = Array.isArray(obj) ? [] : {};
  seen.set(obj, copy);
  for (const k of Object.keys(obj)) copy[k] = deepClone(obj[k], seen);
  return copy;
}
\`\`\`
(For real code \`structuredClone()\` exists and also handles cycles.)

**WeakRef and FinalizationRegistry**
- \`new WeakRef(obj).deref()\` returns the object or \`undefined\` once collected.
- \`FinalizationRegistry\` runs a callback some time after an object is collected.
- GC timing is non-deterministic and differs between engines. **Never rely on them for program correctness**; at most use them for best-effort cache cleanup or resource-leak diagnostics.`,
  },
  {
    id: 'js-debounce-throttle',
    category: 'JS / TS / Node (Senior)',
    difficulty: 2,
    question: 'Implement debounce and throttle and explain the difference.',
    tldr: 'Debounce waits until calls stop for X ms and then runs once (search-as-you-type); throttle runs at most once every X ms no matter how often it is called (scroll, resize, mousemove).',
    answer: `**Debounce**: "run after the user stops doing it". Every call resets the timer.
\`\`\`js
function debounce(fn, wait, { leading = false } = {}) {
  let timer = null;
  function debounced(...args) {
    const callNow = leading && timer === null;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!leading) fn.apply(this, args);
    }, wait);
    if (callNow) fn.apply(this, args);
  }
  debounced.cancel = () => { clearTimeout(timer); timer = null; };
  return debounced;
}

const search = debounce(q => fetch(\`/api/search?q=\${encodeURIComponent(q)}\`), 300);
input.addEventListener('input', e => search(e.target.value));
\`\`\`

**Throttle**: "run at most once per interval". Here with a trailing call so the last value is not lost:
\`\`\`js
function throttle(fn, wait) {
  let last = 0, timer = null, pendingArgs = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer); timer = null;
      last = now;
      fn.apply(this, args);
    } else {
      pendingArgs = args;                     // remember the latest call
      if (!timer) {
        timer = setTimeout(() => {
          last = Date.now(); timer = null;
          fn.apply(this, pendingArgs);
        }, remaining);
      }
    }
  };
}

window.addEventListener('scroll', throttle(updateStickyHeader, 100));
\`\`\`

**Discussion points interviewers like**
- **leading vs trailing** edge options.
- Preserving \`this\` and arguments (\`fn.apply(this, args)\`), and \`cancel\` / \`flush\` methods.
- For visual updates, \`requestAnimationFrame\`-based throttling syncs with the frame rate.
- In React, create the debounced function once (\`useMemo\`/\`useRef\`) and cancel it on unmount, otherwise every render makes a new debouncer.
- For search: debounce the input **and** cancel stale requests (\`AbortController\`) so an old response cannot overwrite a newer one.`,
  },
  {
    id: 'js-promise-all-impl',
    category: 'JS / TS / Node (Senior)',
    difficulty: 3,
    question: 'Implement Promise.all, and a function that runs async tasks with a concurrency limit.',
    tldr: 'Promise.all resolves with results in input order once all fulfil and rejects on the first rejection; a concurrency limiter runs N workers that pull the next task index from a shared counter until the list is exhausted.',
    answer: `**Promise.all**
\`\`\`js
function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);

    items.forEach((item, i) => {
      Promise.resolve(item).then(value => {   // also accepts non-promise values
        results[i] = value;                    // keep input order, not completion order
        if (--remaining === 0) resolve(results);
      }, reject);                              // first rejection wins; later ones are ignored
    });
  });
}
\`\`\`
Points to mention: order preservation, non-promise values, empty input, and that other operations **keep running** after a rejection (Promise.all does not cancel them; use an \`AbortController\` for that).

**Concurrency limit (worker pool)**
\`\`\`js
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;                        // safe: JS is single-threaded between awaits
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);                  // rejects on the first error
  return results;
}

// usage: at most 5 concurrent HTTP requests
const users = await mapLimit(ids, 5, id => fetch(\`/api/users/\${id}\`).then(r => r.json()));
\`\`\`

**Variants and follow-ups**
- **allSettled semantics**: catch inside the worker and store \`{status, value | reason}\`.
- **Stop on first error**: set a flag so workers stop taking new tasks.
- **Promise.race / any** implementations.
- **Retry with backoff** per task.
- In production you might use \`p-limit\` / \`p-map\`, but writing it shows you understand the event loop.`,
  },

  // =====================================================================
  // FRONTEND (SENIOR)
  // =====================================================================
  {
    id: 'fe-rendering-strategies',
    category: 'Frontend (Senior)',
    difficulty: 2,
    question: 'CSR vs SSR vs SSG vs ISR vs streaming: how do you choose?',
    tldr: 'Choose per page based on SEO needs, data freshness and personalisation: static generation for content that rarely changes, ISR for content that changes periodically, SSR/streaming for fresh or personalised SEO pages, and CSR for app-like screens behind login.',
    answer: `**CSR (Client-Side Rendering)**
- The server sends an almost empty HTML shell + a JS bundle; the browser fetches data and renders.
- ✔ Cheap static hosting, app-like interactions.
- ✘ Slow first contentful paint on weak devices, weaker SEO, large bundles hurt LCP and INP.
- Fits: dashboards and admin panels behind login.

**SSR (Server-Side Rendering)**
- HTML generated per request with data; then **hydration** attaches event handlers on the client.
- ✔ Good SEO and fast first paint with fresh, personalised content.
- ✘ Server cost and complexity, TTFB depends on the slowest data fetch, hydration cost (the page looks ready but is not interactive yet).

**SSG (Static Site Generation)**
- HTML built at build time, served from a CDN.
- ✔ Fastest and cheapest, very robust.
- ✘ Content is only as fresh as the last build; build time grows with the number of pages.
- Fits: marketing pages, docs, blogs.

**ISR (Incremental Static Regeneration)**
- Static pages regenerated in the background after a revalidation period or on demand (webhook from the CMS).
- Fits: product catalogues, listings with many pages that change occasionally.

**Streaming SSR and React Server Components**
- The server streams HTML in chunks: the shell immediately, slower parts later inside \`<Suspense>\` boundaries.
- **Server Components** render on the server only, and their code never ships to the browser (smaller bundles, direct data access).
\`\`\`tsx
// Next.js App Router
export default async function ProductPage({ params }) {
  const product = await getProduct(params.id);       // runs on the server
  return (
    <>
      <ProductDetails product={product} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews productId={params.id} />              {/* streamed when ready */}
      </Suspense>
    </>
  );
}
export const revalidate = 300;                          // ISR: regenerate at most every 5 min
\`\`\`

**Islands / partial hydration** (Astro, Qwik's resumability): mostly static HTML with small interactive islands, so very little JS.

**Decision factors**: SEO and social previews, freshness, personalisation, Core Web Vitals targets, infrastructure cost, team experience. Modern frameworks let you mix strategies **per route**.`,
  },
  {
    id: 'fe-web-vitals',
    category: 'Frontend (Senior)',
    difficulty: 2,
    question: 'What are Core Web Vitals and how do you improve them?',
    tldr: 'LCP measures loading (largest element painted, good under 2.5 s), INP measures responsiveness (under 200 ms) and CLS measures visual stability (under 0.1); improve them with fast server responses and prioritised resources, less main-thread JS, and reserved space for content.',
    answer: `Measured at the **75th percentile** of real users (field data: CrUX, RUM). Lab tools (Lighthouse) help debugging but are not the score that counts.

**LCP: Largest Contentful Paint (good ≤ 2.5 s)**: when the largest image or text block becomes visible. Break it down: TTFB → resource load delay → load time → render delay.
- Fast **TTFB**: CDN, caching, SSR/SSG, fewer server round trips.
- Make the LCP image discoverable early and prioritised; **never lazy-load the LCP image**.
- Modern formats (AVIF/WebP), correct sizes (\`srcset\`/\`sizes\`), image CDN.
- Remove render-blocking CSS and JS (critical CSS, \`defer\`), preload key fonts.
\`\`\`html
<link rel="preload" as="image" href="/hero.avif" fetchpriority="high">
<img src="/hero.avif" width="1200" height="600" fetchpriority="high" alt="...">
<script src="/app.js" defer></script>
\`\`\`

**INP: Interaction to Next Paint (good ≤ 200 ms)**: latency from user input to the next frame, for (nearly) the worst interaction. Replaced FID in 2024.
- Break up **long tasks** (> 50 ms); yield to the main thread so the browser can paint.
\`\`\`js
async function processAll(items) {
  for (const [i, item] of items.entries()) {
    process(item);
    if (i % 50 === 0) await (globalThis.scheduler?.yield?.() ?? new Promise(r => setTimeout(r, 0)));
  }
}
\`\`\`
- Ship less JS (code splitting, remove unused libraries), defer third-party scripts.
- Avoid expensive re-renders (memoisation, virtualised lists), and use \`useTransition\` for non-urgent updates.
- Move heavy computation to Web Workers; give immediate visual feedback first.

**CLS: Cumulative Layout Shift (good ≤ 0.1)**: unexpected movement of visible content.
- Always set \`width\`/\`height\` or \`aspect-ratio\` on images, videos and iframes.
- Reserve space for ads, embeds, banners and late-loading content (skeletons).
- Fonts: \`font-display: optional\`/\`swap\` plus fallback metric overrides (\`size-adjust\`).
- Animate with \`transform\`, not \`top/left/height\`.

**Measure in the field**:
\`\`\`js
import { onLCP, onINP, onCLS } from 'web-vitals';
[onLCP, onINP, onCLS].forEach(fn => fn(m => navigator.sendBeacon('/vitals', JSON.stringify(m))));
\`\`\``,
  },
  {
    id: 'fe-react-rendering',
    category: 'Frontend (Senior)',
    difficulty: 3,
    question: 'How does React decide to re-render, and how do you optimise rendering performance?',
    tldr: 'A component re-renders when its state changes, its parent re-renders, or a context it uses changes; reconciliation then diffs the output. Measure with the Profiler, then fix with state colocation, composition, memoisation, context splitting, virtualisation and transitions.',
    answer: `**What triggers a render**
1. Its own **state** changes (\`setState\` with a new value; \`Object.is\` equality bails out).
2. Its **parent re-renders**: by default all children re-render, **even with identical props**.
3. A **context** it consumes changes value.
(Props changing is not a trigger by itself; it is a consequence of the parent rendering.)

A render is just calling the component function. React then **reconciles**: it diffs the new element tree with the previous one and commits only real DOM changes.
- A different element type at the same position → the subtree is unmounted and remounted (state lost).
- Lists need **stable, unique keys**; using the array index with reorderable items causes wrong state and extra work.

**Optimisation toolbox (measure first with React DevTools Profiler)**
- **Move state down (colocation)**: keep fast-changing state in the smallest component that needs it.
- **Lift content up / composition**: pass expensive subtrees as \`children\`; they are created by the parent and do not re-render when the wrapper's state changes.
\`\`\`jsx
function ScrollTracker({ children }) {
  const [y, setY] = useState(0);              // changes constantly
  useEffect(() => { const h = () => setY(window.scrollY); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h); }, []);
  return <div data-y={y}>{children}</div>;     // children do NOT re-render on scroll
}
\`\`\`
- **\`React.memo\`** + stable props: \`useMemo\` for objects and arrays, \`useCallback\` for functions passed to memoised children. The **React Compiler** automates much of this.
\`\`\`jsx
const Row = React.memo(function Row({ item, onSelect }) { /* ... */ });
function List({ items }) {
  const [selected, setSelected] = useState(null);
  const onSelect = useCallback(id => setSelected(id), []);
  return items.map(it => <Row key={it.id} item={it} onSelect={onSelect} />);
}
\`\`\`
- **Context**: split contexts by update frequency, memoise the value object, or use a store with **selectors** (Zustand, Redux, \`useSyncExternalStore\`) so components subscribe to slices.
- **Virtualise long lists** (TanStack Virtual, react-window).
- **Concurrent features**: \`useTransition\` / \`useDeferredValue\` keep input responsive while expensive updates render in the background.
- **Code splitting**: \`React.lazy\` + \`Suspense\` for routes and heavy components.
- Avoid expensive work during render; derive data instead of syncing it with effects.

**Anti-patterns**: \`useEffect\` that just copies props into state, new object or array literals as props to memoised children, putting everything in one global context.`,
  },
  {
    id: 'fe-state-management',
    category: 'Frontend (Senior)',
    difficulty: 2,
    question: 'How do you approach state management in a large frontend application?',
    tldr: 'Classify state first: server state belongs in a data-fetching cache (TanStack Query), shareable UI state in the URL, local UI state in components, forms in a form library, and only the small remainder of true global client state in a store.',
    answer: `**1. Server state (data from APIs)**: usually the majority of "global state".
Use a server-cache library: **TanStack Query**, SWR, RTK Query, Apollo. You get caching, request deduplication, background revalidation, retries, pagination, optimistic updates and invalidation for free.
\`\`\`tsx
const { data, isPending, error } = useQuery({
  queryKey: ['orders', { status }],
  queryFn: () => api.getOrders({ status }),
  staleTime: 30_000,
});

const qc = useQueryClient();
const cancel = useMutation({
  mutationFn: api.cancelOrder,
  onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
});
\`\`\`

**2. URL state**: filters, search, sorting, pagination, selected tab. Put it in query params so it is shareable, bookmarkable and works with the back button (e.g. nuqs, router search params).

**3. Local UI state**: open/closed, hover, input drafts. Use \`useState\`/\`useReducer\` in the component that owns it.

**4. Form state**: React Hook Form / TanStack Form with schema validation (zod) shared with the backend where possible.

**5. Global client state**: authenticated user, theme, feature flags, a shopping cart before checkout, complex editor state.
- Rarely changing → **Context**.
- Frequently changing or large → a store with selectors (**Zustand**, Redux Toolkit, Jotai, MobX).

**Principles**
- **Single source of truth**: do not copy server data into Redux and then sync it by hand (loading flags, stale caches, invalidation bugs).
- **Derive, do not duplicate**: compute filtered lists from source data instead of storing them separately.
- Keep state as **close** as possible to where it is used; lift it only when needed.
- Normalise relational client data if you must store it (by ID).
- Consider state machines (XState) for complex flows with many states (checkout, wizards, uploads).`,
  },
  {
    id: 'fe-browser-rendering',
    category: 'Frontend (Senior)',
    difficulty: 3,
    question: 'Describe the browser rendering pipeline. What is reflow (layout) and how do you avoid unnecessary work?',
    tldr: 'DOM + CSSOM → style → layout → paint → composite; changing geometry triggers layout (expensive), visual properties trigger paint, and transform/opacity can be handled by the compositor alone. Avoid layout thrashing by batching DOM reads before writes.',
    answer: `**Pipeline**
1. **Parse** HTML → DOM, CSS → CSSOM.
2. **Style**: compute the final styles for every element.
3. **Layout (reflow)**: compute geometry: sizes and positions.
4. **Paint**: fill pixels (text, colours, borders, shadows) into layers.
5. **Composite**: combine layers on the GPU into the final frame.

**What a change costs**
- Geometry (\`width\`, \`height\`, \`top\`, \`margin\`, font size, adding or removing elements) → **layout + paint + composite**. Most expensive, and it can affect many other elements.
- Visual only (\`color\`, \`background\`, \`box-shadow\`) → **paint + composite**.
- \`transform\` and \`opacity\` (on a composited layer) → **composite only**. That is why smooth 60/120 fps animations use only these two.

**Layout thrashing (forced synchronous layout)**: reading a layout property (\`offsetHeight\`, \`getBoundingClientRect\`, \`scrollTop\`) after a write forces the browser to compute layout immediately. Doing it in a loop forces layout on every iteration.
\`\`\`js
// ✘ thrashing: read → write → read → write...
for (const el of items) {
  el.style.width = el.parentElement.offsetWidth / 2 + 'px';
}

// ✔ batch reads, then writes
const widths = items.map(el => el.parentElement.offsetWidth);
requestAnimationFrame(() => {
  items.forEach((el, i) => { el.style.width = widths[i] / 2 + 'px'; });
});
\`\`\`

**Other techniques**
- Animate \`transform\`/\`opacity\` instead of \`left\`/\`top\`/\`height\`:
\`\`\`css
.panel { transition: transform 200ms ease; }
.panel.open { transform: translateX(0); }   /* not: left: 0 */
\`\`\`
- \`will-change: transform\` to promote an element to its own layer, sparingly (each layer costs memory).
- **CSS containment**: \`contain: layout paint\` limits the impact of changes inside a component; \`content-visibility: auto\` skips rendering of off-screen sections.
- Batch DOM changes (fragments, or one class change instead of many style changes).
- Virtualise very long lists.
- Debug with the DevTools **Performance** panel (look for purple Layout and green Paint blocks, "Forced reflow" warnings) and the Rendering tab (paint flashing, layer borders).`,
  },

  // =====================================================================
  // CONCURRENCY
  // =====================================================================
  {
    id: 'conc-basics',
    category: 'Concurrency',
    difficulty: 2,
    question: 'Process vs thread vs coroutine/async: what are the differences and when do you use each?',
    tldr: 'Processes have isolated memory, threads share memory inside a process, and coroutines / async tasks / virtual threads are lightweight units scheduled by a runtime; use async or virtual threads for I/O-bound work and real parallelism (threads or processes ≈ CPU cores) for CPU-bound work.',
    answer: `**Process**
- Own address space, file descriptors and resources; isolated by the OS.
- ✔ Strong isolation (one crash does not kill others), true parallelism.
- ✘ Expensive to create, communication via IPC (pipes, sockets, shared memory) with serialisation.
- Examples: Node cluster workers, Python \`multiprocessing\` (bypasses the GIL), PostgreSQL's process-per-connection.

**Thread (OS thread)**
- Shares memory with other threads of the process; own stack (often ~1 MB) and registers.
- ✔ Cheap communication through shared memory, true parallelism on multiple cores.
- ✘ Requires synchronisation (race conditions, deadlocks); thousands of OS threads are heavy (memory, context switches).

**Coroutines / async tasks / green threads / virtual threads**
- Lightweight units scheduled by a **runtime** onto a few OS threads; they suspend at I/O points instead of blocking a thread.
- Examples: JS async/await (single thread), Python asyncio, Kotlin coroutines, **Go goroutines** (multiplexed onto all cores), **Java virtual threads** (Project Loom).
- ✔ Hundreds of thousands to millions of concurrent tasks, ideal for I/O-heavy servers.
- ✘ A CPU-heavy task (or a blocking call) can starve others on the same thread.

**Concurrency vs parallelism**
- **Concurrency** = structuring a program to handle many tasks that are *in progress* at once (interleaving).
- **Parallelism** = actually *executing* multiple things at the same instant on multiple cores.

**Choosing**
- **I/O-bound** (HTTP calls, DB queries) → async / virtual threads / goroutines.
- **CPU-bound** (image processing, compression, ML) → parallelism with workers ≈ the number of cores (thread pool, worker_threads, processes).

\`\`\`js
// Node: offload CPU-heavy work to a worker thread
const { Worker } = require('node:worker_threads');
function hashInWorker(data) {
  return new Promise((resolve, reject) => {
    const w = new Worker('./hash-worker.js', { workerData: data });
    w.once('message', resolve);
    w.once('error', reject);
  });
}
\`\`\`
\`\`\`go
// Go: fan out work over goroutines and collect with a WaitGroup
var wg sync.WaitGroup
for _, url := range urls {
    wg.Add(1)
    go func(u string) { defer wg.Done(); fetch(u) }(url)
}
wg.Wait()
\`\`\``,
  },
  {
    id: 'conc-race-deadlock',
    category: 'Concurrency',
    difficulty: 2,
    question: 'Explain race conditions, deadlock, livelock and starvation, and how to prevent them.',
    tldr: 'A race condition is a result that depends on timing; deadlock is a cycle of tasks waiting on each other; livelock is tasks busily reacting without progress; starvation is a task that never gets a resource. Prevent them with proper synchronisation, lock ordering, timeouts with backoff and fair scheduling.',
    answer: `**Race condition**: correctness depends on the interleaving of operations. Classic: \`count++\` is read → modify → write, so two threads can both read 5 and both write 6.
\`\`\`java
// Java: unsafe vs safe counter
class Counter {
  private int unsafe = 0;
  private final AtomicInteger safe = new AtomicInteger();
  void inc() { unsafe++; safe.incrementAndGet(); }
}
\`\`\`
Fixes: mutual exclusion (locks), atomic operations, **immutability**, confinement (one owner thread or actor per piece of data), message passing (channels).

**Races exist in single-threaded JS too** (async interleaving):
\`\`\`js
// user types "re" then "react"; the "re" response arrives last and overwrites the results
let controller;
async function search(q) {
  controller?.abort();                       // cancel the previous request
  controller = new AbortController();
  const res = await fetch(\`/search?q=\${q}\`, { signal: controller.signal });
  render(await res.json());
}
\`\`\`
Other JS examples: check-then-act across an \`await\` ("if (!cache[key]) cache[key] = await load()" loads twice), and double submits.

**Deadlock**: tasks wait for each other in a cycle. All four **Coffman conditions** must hold: mutual exclusion, hold and wait, no preemption, **circular wait**. Break any one:
- Acquire locks in a **global order**.
- \`tryLock\` with timeout, release everything and retry.
- Hold fewer locks and for shorter times; avoid calling unknown code (callbacks) while holding a lock.

**Livelock**: tasks are not blocked but keep reacting to each other without progress (two people stepping aside in a corridor in sync; two transactions repeatedly aborting each other). Fix: **randomised backoff**, or a priority / tie-breaker.

**Starvation**: a task never gets the resource because others always win (unfair locks, priority inversion, readers starving writers in a read-write lock). Fix: fair locks/queues, aging priorities, limits per client.

**Detection tools**: thread dumps (\`jstack\`), race detectors (\`go test -race\`, ThreadSanitizer), stress and property-based testing, database deadlock logs.`,
  },
  {
    id: 'conc-primitives',
    category: 'Concurrency',
    difficulty: 3,
    question: 'Mutex, semaphore, read-write lock, condition variable, CAS: how do they differ?',
    tldr: 'A mutex allows one owner at a time, a semaphore allows N, a read-write lock allows many readers or one writer, a condition variable lets threads wait for a condition, and CAS is an atomic CPU instruction underlying lock-free algorithms. Memory visibility is part of the picture too.',
    answer: `**Mutex (lock)**: mutual exclusion; only the owner may unlock. Protects a critical section.
\`\`\`java
private final ReentrantLock lock = new ReentrantLock();
void transfer() {
  lock.lock();
  try { /* critical section */ } finally { lock.unlock(); }   // always unlock in finally
}
\`\`\`

**Semaphore**: a counter of permits; up to **N** holders at once. Used to limit concurrency (e.g. max 10 parallel calls to an API, connection pools). A binary semaphore resembles a mutex but has no ownership.
\`\`\`js
class Semaphore {
  constructor(n) { this.n = n; this.waiters = []; }
  async acquire() { if (this.n > 0) { this.n--; return; } await new Promise(r => this.waiters.push(r)); }
  release() { const next = this.waiters.shift(); next ? next() : this.n++; }
}
const sem = new Semaphore(10);
async function limited(task) { await sem.acquire(); try { return await task(); } finally { sem.release(); } }
\`\`\`

**Read-write lock**: many concurrent readers **or** one exclusive writer. Pays off when reads dominate and critical sections are not tiny. Watch for writer starvation.

**Condition variable**: wait until a condition becomes true, releasing the lock while waiting (producer/consumer). Always wait in a **loop** because of spurious wakeups.
\`\`\`go
mu.Lock()
for len(queue) == 0 {
    cond.Wait()            // atomically unlocks mu and sleeps; relocks on wake
}
item := queue[0]; queue = queue[1:]
mu.Unlock()
\`\`\`

**CAS (compare-and-swap)**: an atomic CPU instruction: "set X to new only if it still equals expected". The building block of **lock-free** structures (atomic counters, \`ConcurrentHashMap\`, lock-free queues).
\`\`\`java
AtomicLong max = new AtomicLong();
void offer(long v) {
  long cur;
  do { cur = max.get(); if (v <= cur) return; }
  while (!max.compareAndSet(cur, v));      // retry if someone changed it meanwhile
}
\`\`\`
Issues: the **ABA problem** (value changed A→B→A unnoticed; solved with versioned or tagged pointers), and busy retry loops under heavy contention.

**Memory model and visibility**: without synchronisation, CPUs and compilers may reorder instructions and keep values in caches, so one thread may never see another's write. Locks, \`volatile\` (Java), atomics and channels create **happens-before** relationships that guarantee visibility.

**Higher-level alternatives** that are usually safer: concurrent collections, channels (Go), actors (Akka, Erlang), immutable data, thread confinement, and \`Atomics\` + \`SharedArrayBuffer\` in JS workers.`,
  },
]);
