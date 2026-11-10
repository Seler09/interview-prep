/*
  QUESTION BANK: FUNDAMENTALS
  This file also defines the addQuestions() helper used by the senior files.

  Question fields:
    id         unique id; progress is stored by id, so never change it later
    category   category name (filters are generated automatically)
    difficulty 1 = easy, 2 = medium, 3 = hard
    question   the question text
    tldr       optional one-sentence summary; lead with this in an interview
    answer     full answer in mini-markdown:
                 **bold**, `code`, "- " bullet lists, "1. " numbered lists,
                 sub-items indented by 2 spaces, ``` code blocks ```,
                 blank line = new paragraph
                 (inside template strings, write a backtick as \`)
    followUps  optional list of likely follow-up questions:
                 'question'  or  { q: 'question', a: 'answer (mini-markdown)' }
*/
window.QUESTIONS = window.QUESTIONS || [];
window.addQuestions = (level, list) => {
  list.forEach(q => { q.level = level; });
  window.QUESTIONS.push(...list);
};

addQuestions('basic', [
  // =====================================================================
  // JAVASCRIPT
  // =====================================================================
  {
    id: 'js-var-let-const',
    category: 'JavaScript',
    difficulty: 1,
    question: 'What is the difference between var, let and const?',
    tldr: '`var` is function-scoped and hoisted as `undefined`; `let` and `const` are block-scoped and live in the temporal dead zone until declared, and `const` cannot be reassigned.',
    answer: `**Scope**
- \`var\` is **function-scoped**. A \`var\` declared inside an \`if\` or \`for\` block is visible in the whole enclosing function.
- \`let\` and \`const\` are **block-scoped**. They only exist inside the nearest \`{ }\`.

**Hoisting and the temporal dead zone (TDZ)**
- \`var\` declarations are hoisted and initialised to \`undefined\`, so reading one before its declaration silently gives \`undefined\`.
- \`let\` and \`const\` are hoisted too, but stay **uninitialised** until the declaration line runs. Accessing them earlier throws a \`ReferenceError\`. That window is the TDZ.

**Re-declaration and re-assignment**
- \`var\` can be re-declared in the same scope, which hides bugs.
- \`let\` can be reassigned but not re-declared.
- \`const\` can be neither. It must be initialised at declaration.

**const is not immutability.** It makes the *binding* constant, not the value. You can still mutate a \`const\` object or array. For a truly immutable value use \`Object.freeze\` (shallow) or immutable data patterns.

**Classic loop bug**
\`\`\`js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i)); // 3 3 3
for (let j = 0; j < 3; j++) setTimeout(() => console.log(j)); // 0 1 2
\`\`\`
\`let\` creates a fresh binding per iteration, so each closure captures its own value.

**Also:** a top-level \`var\` in a script becomes a property of \`window\`/\`globalThis\`; \`let\`/\`const\` do not.

**In practice:** use \`const\` by default, \`let\` when the value has to change, and avoid \`var\` in modern code.`,
    followUps: [
      { q: 'Can you change a property of an object declared with const?', a: 'Yes. `const` only prevents reassigning the variable. `const user = {}; user.name = "Ann"` works, `user = {}` throws. Use `Object.freeze` to block (shallow) mutation.' },
      { q: 'Why does the var loop print 3 3 3?', a: 'There is a single function-scoped `i` shared by all callbacks. By the time the timeouts run, the loop has finished and `i` is 3. `let` creates a new binding for every iteration.' },
    ],
  },
  {
    id: 'js-closure',
    category: 'JavaScript',
    difficulty: 2,
    question: 'What is a closure?',
    tldr: 'A closure is a function bundled with references to the variables of the scope where it was created, so it can still use them after that scope has returned.',
    answer: `In JavaScript, functions capture their **lexical environment**: the variables that were in scope where the function was *defined*, not where it is *called*. As long as the inner function is reachable, those variables stay alive.

\`\`\`js
function createCounter() {
  let count = 0;                 // private state
  return {
    increment: () => ++count,
    get: () => count,
  };
}
const c = createCounter();
c.increment(); c.increment();
c.get(); // 2. Nothing outside can touch count directly
\`\`\`

**Closures capture variables, not values.** If the variable changes later, the closure sees the new value.

**Typical uses**
- **Data privacy / encapsulation**: module pattern, private state without classes.
- **Function factories and partial application**: \`const add5 = makeAdder(5)\`.
- **Callbacks and event handlers** that need context from where they were created.
- **Memoization**: a cache kept in the closure.
- **React hooks** are built on closures, which also explains "stale closure" bugs in \`useEffect\` when dependencies are missing.

**Pitfalls**
- **Memory**: a closure keeps its whole captured scope alive. A long-lived listener that closes over a big object prevents it from being garbage-collected.
- **Stale values**: a callback created in an old render or iteration keeps seeing the old variables.`,
    followUps: [
      { q: 'What is a stale closure in React?', a: 'A callback (e.g. inside `useEffect` or `setInterval`) captures state from the render in which it was created. If the effect does not re-run, the callback keeps reading the old value. Fix: list correct dependencies, use the functional updater `setX(x => x + 1)`, or keep the latest value in a ref.' },
      'Implement a memoize function using a closure.',
    ],
  },
  {
    id: 'js-equality',
    category: 'JavaScript',
    difficulty: 1,
    question: 'What is the difference between == and ===?',
    tldr: '`===` compares value and type with no conversion; `==` first coerces both sides to a common type, which leads to surprising results.',
    answer: `**Strict equality \`===\`**: true only if both operands have the same type and the same value. No conversion happens.

**Loose equality \`==\`**: applies the *abstract equality* algorithm, which converts operands before comparing:
- \`null == undefined\` is \`true\` (and they are equal to nothing else),
- number vs string: the string is converted to a number (\`'1' == 1\` → true),
- boolean vs anything: the boolean becomes a number first (\`true == '1'\` → true),
- object vs primitive: the object is converted via \`valueOf\`/\`toString\`.

**Surprises**
\`\`\`js
'' == 0            // true
'0' == false       // true
[] == false        // true
[] == ![]          // true
null == 0          // false
NaN == NaN         // false (also with ===)
\`\`\`

**Objects** are compared by **reference** with both operators: \`{} === {}\` is false.

**Edge cases of ===**
- \`NaN === NaN\` is false. Use \`Number.isNaN(x)\`.
- \`+0 === -0\` is true. \`Object.is(+0, -0)\` is false and \`Object.is(NaN, NaN)\` is true; that is "SameValue" equality.

**Rule of thumb:** always use \`===\`. The one widely accepted exception is \`x == null\`, a concise check for "null or undefined".`,
  },
  {
    id: 'js-event-loop',
    category: 'JavaScript',
    difficulty: 3,
    question: 'Explain the event loop. What does this print?\n\nconsole.log(1);\nsetTimeout(() => console.log(2));\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);',
    tldr: 'Output is 1, 4, 3, 2: synchronous code runs first, then all microtasks (promise callbacks), and only then the next macrotask (the timer).',
    answer: `JavaScript runs on a **single thread** with one **call stack**. Asynchronous work (timers, network, I/O) is handled by the host (browser or Node), which queues callbacks when the work is done. The **event loop** decides when those callbacks run.

**The two important queues**
- **Microtask queue**: promise reactions (\`then/catch/finally\`, code after \`await\`), \`queueMicrotask\`, \`MutationObserver\`.
- **Macrotask (task) queue**: \`setTimeout\`, \`setInterval\`, I/O callbacks, UI events, \`MessageChannel\`.

**The loop, simplified**
1. Run the current task (e.g. the whole script) until the call stack is empty.
2. Run **all** microtasks, including microtasks queued by other microtasks.
3. In the browser, render if needed (\`requestAnimationFrame\`, style, layout, paint).
4. Take the **next one** macrotask and repeat.

**Walking through the example**
- \`console.log(1)\` → prints **1**.
- \`setTimeout\` → callback queued as a macrotask.
- \`Promise.resolve().then\` → callback queued as a microtask.
- \`console.log(4)\` → prints **4**.
- Stack empty → microtasks run → prints **3**.
- Next macrotask → prints **2**.

**Practical consequences**
- \`setTimeout(fn, 0)\` means "as soon as possible after microtasks and maybe a render", never immediately. Browsers also clamp nested timers to ≥ 4 ms.
- An endless chain of microtasks **starves** rendering and timers, and the page freezes.
- Long synchronous work (> 50 ms) blocks input handling and hurts INP. Split it up or move it to a Web Worker.`,
    followUps: [
      { q: 'Where does code after `await` run?', a: 'The rest of the async function after `await` is scheduled as a microtask once the awaited promise settles. So it runs before any pending `setTimeout` callbacks.' },
      { q: 'How is the Node.js event loop different?', a: 'Node uses libuv with distinct phases (timers, pending callbacks, poll, check for `setImmediate`, close). `process.nextTick` callbacks run before promise microtasks, between each callback. See the senior question on Node event loop phases.' },
    ],
  },
  {
    id: 'js-async-await',
    category: 'JavaScript',
    difficulty: 2,
    question: 'What is a Promise and how does it relate to async/await?',
    tldr: 'A Promise is an object representing the eventual result of an async operation; async/await is syntax on top of promises that lets you write that flow like synchronous code.',
    answer: `**Promise basics**
- States: **pending** → **fulfilled** (with a value) or **rejected** (with a reason). Once settled, it never changes.
- \`then\` returns a **new** promise, which enables chaining. Returning a promise from \`then\` flattens it.
- \`catch\` handles rejections from anywhere earlier in the chain; \`finally\` runs either way.

**async/await**
- An \`async\` function **always returns a promise**. \`return x\` resolves it, \`throw\` rejects it.
- \`await\` pauses the function (not the thread) until the promise settles, then resumes with the value or throws the error.
- Error handling uses ordinary \`try/catch\`.

\`\`\`js
async function loadUser(id) {
  try {
    const res = await fetch(\`/api/users/\${id}\`);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`); // fetch does not reject on 4xx/5xx
    return await res.json();
  } catch (err) {
    console.error('Failed to load user', err);
    throw err;
  }
}
\`\`\`

**Sequential vs parallel.** A very common performance bug:
\`\`\`js
const a = await getA();             // waits
const b = await getB();             // then waits again: total = A + B
const [x, y] = await Promise.all([getA(), getB()]); // parallel: total = max(A, B)
\`\`\`

**Combinators**
- \`Promise.all\`: all must succeed; rejects on the first failure.
- \`Promise.allSettled\`: waits for all and gives each outcome.
- \`Promise.race\`: first to settle wins (useful for timeouts).
- \`Promise.any\`: first to **fulfil** wins; rejects only if all fail.

**Pitfalls**
- Forgetting \`await\`: you get a pending promise and errors become unhandled rejections.
- \`await\` inside \`forEach\` does not wait. Use \`for...of\` (sequential) or \`Promise.all(items.map(...))\` (parallel).
- Unlimited \`Promise.all\` over thousands of items can overload a server. Use a concurrency limit.`,
    followUps: [
      { q: 'How do you add a timeout to a fetch?', a: 'Use `AbortController` (or `AbortSignal.timeout(ms)` in modern runtimes) and pass `signal` to `fetch`. `Promise.race` with a timer only stops waiting; it does not cancel the request.' },
      'Implement Promise.all yourself.',
    ],
  },
  {
    id: 'js-this',
    category: 'JavaScript',
    difficulty: 2,
    question: 'How is the value of `this` determined in JavaScript?',
    tldr: '`this` is decided by how a function is called (method call, plain call, `new`, `call/apply/bind`), except for arrow functions, which take `this` from the surrounding scope.',
    answer: `Rules, in order of precedence:

1. **\`new\` binding**: \`new Foo()\` → \`this\` is the newly created object.
2. **Explicit binding**: \`fn.call(obj, ...)\`, \`fn.apply(obj, [...])\`, \`fn.bind(obj)\` → \`this\` is \`obj\`. A bound function cannot be re-bound.
3. **Implicit binding**: \`obj.method()\` → \`this\` is \`obj\`, the object to the left of the dot at call time.
4. **Default binding**: plain \`fn()\` → \`undefined\` in strict mode (modules and classes are strict), or the global object in sloppy mode.

**Arrow functions** have **no own \`this\`**. They capture it lexically from the enclosing scope, and \`call\`/\`bind\` cannot change it.

**The classic bug: losing \`this\`**
\`\`\`js
class Timer {
  seconds = 0;
  start() {
    setInterval(function () { this.seconds++; }, 1000); // this is undefined
    setInterval(() => { this.seconds++; }, 1000);        // works: lexical this
  }
}
const { start } = new Timer(); start(); // extracted method: this is lost
\`\`\`

**Fixes**: arrow functions, \`.bind(this)\` in the constructor, or class field arrows (\`handle = () => {}\`).

**Other cases**
- DOM event handlers set with \`addEventListener(function(){})\` get \`this = event.currentTarget\`.
- Object-literal methods written as arrows do **not** get the object as \`this\`.`,
  },
  {
    id: 'js-hoisting',
    category: 'JavaScript',
    difficulty: 1,
    question: 'What is hoisting?',
    tldr: 'Before code runs, JavaScript registers declarations in their scope, so functions can be called before they appear, `var` reads as `undefined`, and `let/const/class` throw until their declaration line.',
    answer: `When a scope is entered, the engine first processes declarations (creation phase), then executes code. That is why declarations *seem* to move to the top.

**What gets hoisted, and how**
- **Function declarations**: fully hoisted, name and body. You can call them before they appear.
- **\`var\`**: the name is hoisted and initialised to \`undefined\`.
- **\`let\`, \`const\`, \`class\`**: hoisted but **not initialised**. Access before the declaration throws \`ReferenceError\` (temporal dead zone).
- **Function expressions and arrows** (\`const f = () => {}\`) follow the rules of the variable they are assigned to.

\`\`\`js
sayHi();            // works
function sayHi() {}

console.log(a);     // undefined
var a = 1;

console.log(b);     // ReferenceError (TDZ)
let b = 2;

greet();            // TypeError: greet is not a function (it is undefined)
var greet = function () {};
\`\`\`

**Why it matters**: hoisting explains confusing \`undefined\` values and order-dependent bugs. Modern style (\`const\`/\`let\`, declare before use, ES modules) mostly avoids it. Linters flag use-before-define.`,
  },

  // =====================================================================
  // HTML & CSS
  // =====================================================================
  {
    id: 'css-box-model',
    category: 'HTML & CSS',
    difficulty: 1,
    question: 'Explain the CSS box model.',
    tldr: 'Every element is a box made of content, padding, border and margin; `box-sizing` decides whether `width` covers only the content or content + padding + border.',
    answer: `From the inside out:
- **Content**: the text or children; sized by \`width\` / \`height\`.
- **Padding**: space between content and border. It takes the element's background.
- **Border**: the line around the padding.
- **Margin**: transparent space outside the border that separates the element from its neighbours.

**box-sizing**
- \`content-box\` (default): \`width: 200px\` is the content only. Add \`padding: 20px; border: 5px\` and the rendered width is **250px**.
- \`border-box\`: \`width\` includes padding and border, so the element really is 200px. Much easier to reason about, which is why most projects set it globally:
\`\`\`css
*, *::before, *::after { box-sizing: border-box; }
\`\`\`

**Margin collapsing**: vertical margins of adjacent block elements (or a parent and its first/last child) collapse into the larger of the two instead of adding up. It does **not** happen in flex or grid containers, with padding/border in between, or for horizontal margins.

**Display matters**
- Block elements take the full width and respect all box properties.
- Inline elements ignore \`width\`/\`height\`, and vertical margins do not push other lines away.
- \`inline-block\` flows inline but respects width, height and vertical spacing.

DevTools shows the box model of any element visually, which is the quickest way to debug spacing.`,
  },
  {
    id: 'css-flex-grid',
    category: 'HTML & CSS',
    difficulty: 2,
    question: 'Flexbox or Grid: when do you use which?',
    tldr: 'Flexbox is for one-dimensional layouts where content decides the sizes; Grid is for two-dimensional layouts where the container defines rows and columns. Most real layouts combine both.',
    answer: `**Flexbox: one dimension (a row OR a column)**
- Content-first: items size themselves and flex fills or shrinks along the main axis.
- Great for navigation bars, button groups, toolbars, centring, and form rows (label + input + button).
- Key properties: \`justify-content\` (main axis), \`align-items\` (cross axis), \`gap\`, and \`flex: 1 1 auto\` (grow, shrink, basis), \`flex-wrap\`.

**Grid: two dimensions (rows AND columns)**
- Layout-first: the container defines a grid and items are placed into it.
- Great for page layouts, dashboards, card galleries and anything that has to align both ways.
- Key features: \`grid-template-columns\`, \`fr\` units, \`minmax()\`, \`grid-template-areas\`, \`auto-fit\`/\`auto-fill\`, and items spanning cells.

\`\`\`css
/* responsive card gallery without media queries */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
\`\`\`

**Rules of thumb**
- Items flowing in one line, sizes driven by content → **Flexbox**.
- Need rows and columns to line up → **Grid**.
- Typical combination: Grid for the page skeleton, Flexbox inside components.
- **Subgrid** (now widely supported) lets nested items align to the parent grid, for example card titles and footers lining up across cards.`,
  },
  {
    id: 'css-specificity',
    category: 'HTML & CSS',
    difficulty: 2,
    question: 'How does CSS specificity work?',
    tldr: 'When rules conflict, the browser compares specificity as a tuple (IDs, classes/attributes/pseudo-classes, elements); the higher tuple wins, and on a tie the later rule wins.',
    answer: `**The cascade, in order**
1. Origin and importance (user-agent, user and author styles; \`!important\` flips priority).
2. **Cascade layers** (\`@layer\`): later layers win, and unlayered styles beat layered ones.
3. **Specificity**.
4. **Source order**: the last declared rule wins.

**Calculating specificity (a, b, c)**
- **a**: ID selectors (\`#header\`).
- **b**: classes, attribute selectors, pseudo-classes (\`.btn\`, \`[type="text"]\`, \`:hover\`).
- **c**: element selectors and pseudo-elements (\`div\`, \`::before\`).
- Compared left to right: \`(1,0,0)\` beats \`(0,15,0)\`. Classes never "add up" to an ID.

**Examples**
- \`#nav .item a\` → (1, 1, 1)
- \`.card .title\` → (0, 2, 0)
- \`ul li\` → (0, 0, 2)

**Special cases**
- Inline styles beat any selector.
- \`!important\` beats normal declarations; use it only for utilities or overriding third-party CSS.
- \`:is()\` and \`:not()\` take the specificity of their most specific argument; \`:where()\` always has **zero** specificity, which is great for easily overridable base styles.
- The universal selector \`*\` and combinators add nothing.

**Good practice**: keep specificity low and flat (single classes, BEM, utility CSS, CSS Modules), avoid IDs for styling, and use \`@layer\` to order resets, components and utilities without specificity wars.`,
  },
  {
    id: 'html-semantics',
    category: 'HTML & CSS',
    difficulty: 1,
    question: 'Why does semantic HTML matter?',
    tldr: 'Semantic elements describe meaning, so you get accessibility, keyboard support, SEO and readable code for free instead of rebuilding them with divs and ARIA.',
    answer: `**Semantic elements** say what the content *is*: \`header\`, \`nav\`, \`main\`, \`article\`, \`section\`, \`aside\`, \`footer\`, \`button\`, \`a\`, \`label\`, \`h1–h6\`, \`ul/ol\`, \`table\`, \`figure\`, \`time\`.

**Why it matters**
- **Accessibility**: screen readers build their navigation from landmarks and headings. Users jump between \`main\`, \`nav\` and headings. A \`<div>\` soup is one flat blob.
- **Built-in behaviour**: \`<button>\` is focusable, fires on Enter and Space, has the "button" role and works with forms. A \`<div onclick>\` needs \`tabindex\`, \`role\`, key handlers and focus styles to come close.
- **Forms**: \`<label for>\` enlarges the click target and names the input for assistive tech; the right \`input type\` (\`email\`, \`tel\`, \`number\`) brings the correct mobile keyboard and validation.
- **SEO**: search engines understand the structure, headings and main content better.
- **Maintainability**: the markup documents itself.

**ARIA rule #1**: do not use ARIA if a native element exists. ARIA only changes what assistive tech is *told*, not the behaviour.

**Common mistakes**
- Clickable divs and spans instead of \`button\` / \`a\`.
- \`<a>\` without \`href\` used as a button. Links navigate, buttons act.
- Skipping heading levels or choosing headings for their font size.
- Images without \`alt\` (use \`alt=""\` for decorative ones).
- Placeholder used instead of a label.`,
  },

  // =====================================================================
  // GIT
  // =====================================================================
  {
    id: 'git-merge-rebase',
    category: 'Git',
    difficulty: 2,
    question: 'What is the difference between git merge and git rebase?',
    tldr: 'Merge joins histories with a merge commit and keeps them as they were; rebase replays your commits on top of another branch, creating new commits and a linear history. Never rebase commits that others already have.',
    answer: `**git merge**
- Creates a **merge commit** with two parents, joining the two lines of history.
- Non-destructive: existing commits are untouched, and the history shows exactly when branches diverged and merged.
- Downside: a busy repo gets a tangled graph full of "Merge branch main into feature" commits.
- If the target has not moved, git can **fast-forward** (just move the pointer). \`--no-ff\` forces a merge commit anyway.

**git rebase**
- Takes your commits and **replays** them on top of the new base, one by one.
- Gives a **linear**, clean history, but rewrites commits: new SHAs, new commit objects.
- Conflicts are resolved commit by commit.
- \`git rebase -i\` lets you squash, reorder, edit and reword commits, useful for tidying a branch before review.

**The golden rule**: **do not rebase commits that have been pushed and that others might have based work on.** Rewriting shared history forces everyone to reconcile diverged branches. Rebasing your own unpublished, or solely owned, feature branch is fine. Then push with \`--force-with-lease\` (not plain \`--force\`), which refuses to overwrite commits you have not seen.

**Common team workflows**
- Rebase your feature branch on \`main\` to stay current, then merge (often squash-merge) via the PR.
- **Squash merge**: the whole PR becomes one commit on \`main\`. Clean, but you lose granular history.
- \`git pull --rebase\` avoids pointless merge commits when syncing.`,
    followUps: [
      { q: 'What does --force-with-lease protect you from?', a: 'It only overwrites the remote branch if it still points where your local remote-tracking ref thinks it does. If a teammate pushed in the meantime, the push is rejected instead of silently deleting their commits.' },
      { q: 'How do you undo a bad rebase?', a: '`git reflog` shows where HEAD was before the rebase. `git reset --hard <that-entry>` restores the branch. Nothing is lost until the reflog expires.' },
    ],
  },
  {
    id: 'git-reset-revert',
    category: 'Git',
    difficulty: 2,
    question: 'git reset vs git revert: when do you use which?',
    tldr: '`revert` adds a new commit that undoes an old one and is safe on shared branches; `reset` moves the branch pointer back and rewrites history, so use it only for local work.',
    answer: `**git revert <commit>**
- Creates a **new commit** that applies the inverse of the given commit.
- History is preserved, so it is **safe on shared branches** like \`main\`.
- Reverting a merge commit needs \`-m 1\` to say which parent is the mainline.
- Standard way to quickly roll back a bad change in production.

**git reset <commit>**: moves the current branch pointer (and HEAD) to another commit. Three modes:
- \`--soft\`: undone commits' changes stay **staged**. Handy for squashing the last few commits into one.
- \`--mixed\` (default): changes stay in the **working directory**, unstaged.
- \`--hard\`: changes are **discarded** completely. Dangerous: uncommitted work is gone.

Because reset removes commits from the branch, it **rewrites history**. Fine for local, unpushed work. On a shared branch it forces others to deal with diverged history.

**Related tools**
- \`git restore <file>\` discards working-copy changes to a file; \`git restore --staged\` unstages.
- \`git commit --amend\` fixes the last commit (also a history rewrite).
- \`git reflog\` is the safety net: it records where HEAD has been, so even a \`reset --hard\` can usually be undone.

**Summary**: pushed and shared → \`revert\`. Local and private → \`reset\` (or \`rebase -i\`) is fine.`,
  },

  // =====================================================================
  // DATABASES
  // =====================================================================
  {
    id: 'sql-joins',
    category: 'Databases',
    difficulty: 1,
    question: 'What types of JOIN are there in SQL?',
    tldr: 'INNER returns only matching rows; LEFT/RIGHT keep all rows from one side with NULLs where there is no match; FULL keeps both sides; CROSS is the Cartesian product.',
    answer: `Assume \`users\` and \`orders(user_id)\`.

- **INNER JOIN**: only rows with a match on both sides. Users without orders disappear.
\`\`\`sql
SELECT u.name, o.total
FROM users u
JOIN orders o ON o.user_id = u.id;
\`\`\`
- **LEFT (OUTER) JOIN**: all rows from the left table, plus matches from the right; no match → NULLs. Classic use is finding rows **without** a match:
\`\`\`sql
SELECT u.*
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE o.id IS NULL;   -- users who never ordered (anti-join)
\`\`\`
- **RIGHT JOIN**: the mirror of LEFT. Usually rewritten as a LEFT JOIN for readability.
- **FULL OUTER JOIN**: all rows from both sides, NULLs where unmatched. Not supported in MySQL (emulate with \`UNION\`).
- **CROSS JOIN**: every combination (N × M rows). Useful for generating combinations, such as all sizes × all colours.
- **SELF JOIN**: a table joined with itself, e.g. employee → manager in the same table.

**Gotchas**
- A filter on the right table placed in \`WHERE\` turns a LEFT JOIN into an INNER JOIN. Put it in the \`ON\` clause if you want to keep unmatched rows.
- One-to-many joins **multiply rows**. Aggregating after such a join can double-count. Aggregate in a subquery first, or use \`COUNT(DISTINCT ...)\`.
- \`EXISTS\` / \`NOT EXISTS\` are often clearer (and handle NULLs better) than joins for "has / has no related rows".`,
  },
  {
    id: 'sql-index',
    category: 'Databases',
    difficulty: 2,
    question: 'What is a database index and what are its costs?',
    tldr: 'An index is an extra, sorted data structure (usually a B-tree) that lets the database find rows without scanning the whole table, at the cost of storage and slower writes.',
    answer: `**How it works**: a B-tree index keeps the indexed column values sorted with pointers to the rows. A lookup or range scan goes from O(n) (full table scan) to roughly O(log n). Sorted order also helps \`ORDER BY\` and \`MIN/MAX\`.

**Good candidates for indexing**
- Columns used in \`WHERE\`, \`JOIN ... ON\` (foreign keys!) and \`ORDER BY\`.
- High-selectivity columns (many distinct values: email, user_id).
- Unique constraints are enforced through indexes.

**Costs and trade-offs**
- **Writes get slower**: every INSERT, UPDATE of an indexed column and DELETE must update every index.
- **Storage and memory**: indexes take disk space and compete for cache (buffer pool).
- **Low selectivity** (booleans, status with 3 values) gives little benefit; the planner may still choose a full scan.
- Too many overlapping indexes slow writes and confuse maintenance. Unused indexes should be dropped (\`pg_stat_user_indexes\` shows usage).

**Composite indexes**: \`(country, city)\` helps queries filtering on \`country\` or on \`country + city\`, but not on \`city\` alone (leftmost-prefix rule). Column order matters.

**Clustered vs non-clustered**
- In MySQL InnoDB the table itself is stored ordered by the primary key (clustered index). Secondary indexes point to the PK.
- In PostgreSQL, tables are heaps and all indexes point to row locations.

**How to verify**: run \`EXPLAIN\` (or \`EXPLAIN ANALYZE\`) and check whether you get an index scan or a sequential scan.`,
    followUps: [
      { q: 'Why might the database ignore an index you created?', a: 'Low selectivity (a scan is cheaper), a function or type cast applied to the column, a leading-wildcard LIKE, outdated statistics, or a composite index whose leading column is not in the filter.' },
    ],
  },
  {
    id: 'sql-acid',
    category: 'Databases',
    difficulty: 2,
    question: 'What does ACID mean?',
    tldr: 'ACID is the set of guarantees a transactional database gives: Atomicity (all or nothing), Consistency (constraints hold), Isolation (concurrent transactions do not interfere) and Durability (committed data survives crashes).',
    answer: `- **Atomicity**: all statements in a transaction succeed or none do. If you debit one account and the credit to the other fails, the debit is rolled back. Implemented with undo logs / rollback segments.
- **Consistency**: a transaction moves the database from one valid state to another, so constraints (PK, FK, UNIQUE, CHECK) always hold. Note: business-level consistency is partly the application's job.
- **Isolation**: concurrent transactions behave *as if* they ran one at a time, to a degree set by the **isolation level**:
  - Read Uncommitted (dirty reads allowed),
  - Read Committed (PostgreSQL default),
  - Repeatable Read (MySQL InnoDB default),
  - Serializable (strongest).
  Weaker levels are faster but allow anomalies (non-repeatable reads, phantoms, lost updates, write skew).
- **Durability**: once committed, data survives crashes and power loss. Implemented with a **write-ahead log (WAL / redo log)** flushed to disk on commit, plus replication for hardware failures.

**Example**
\`\`\`sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;  -- both changes or neither
\`\`\`

**Contrast with BASE** (Basically Available, Soft state, Eventual consistency), the model of many distributed NoSQL stores, which trade strict guarantees for availability and scale.`,
  },
  {
    id: 'sql-where-having',
    category: 'Databases',
    difficulty: 1,
    question: 'What is the difference between WHERE and HAVING?',
    tldr: '`WHERE` filters individual rows before grouping; `HAVING` filters groups after `GROUP BY` and can use aggregate functions.',
    answer: `**Logical order of a SELECT query** (not the order you write it in):
1. \`FROM\` / \`JOIN\`
2. \`WHERE\`: filters **rows**
3. \`GROUP BY\`
4. \`HAVING\`: filters **groups**
5. \`SELECT\`
6. \`DISTINCT\`
7. \`ORDER BY\`
8. \`LIMIT\` / \`OFFSET\`

That order explains the rules:
- \`WHERE\` cannot use aggregates (\`COUNT\`, \`SUM\`) because groups do not exist yet.
- \`HAVING\` can use aggregates because it runs after grouping.
- Column aliases from \`SELECT\` usually cannot be used in \`WHERE\` (it runs before SELECT), though some databases allow them in \`HAVING\`/\`ORDER BY\`.

\`\`\`sql
SELECT department, COUNT(*) AS headcount, AVG(salary) AS avg_salary
FROM employees
WHERE active = true            -- drop inactive rows first
GROUP BY department
HAVING COUNT(*) > 5            -- keep only big departments
ORDER BY avg_salary DESC;
\`\`\`

**Performance tip**: filter as much as possible in \`WHERE\`. It reduces the rows that need grouping and can use indexes. A condition on a non-aggregated column belongs in \`WHERE\`, not \`HAVING\`.`,
  },

  // =====================================================================
  // PROGRAMMING FUNDAMENTALS
  // =====================================================================
  {
    id: 'oop-pillars',
    category: 'Programming Fundamentals',
    difficulty: 1,
    question: 'Name and explain the four pillars of object-oriented programming.',
    tldr: 'Encapsulation hides state behind methods, abstraction exposes only what matters, inheritance reuses behaviour through an is-a relationship, and polymorphism lets one interface have many implementations.',
    answer: `**1. Encapsulation**
Bundle data with the methods that operate on it and **hide internal state**. Callers use a public interface, so invariants stay protected.
Example: \`account.withdraw(100)\` validates the balance; nobody sets \`account.balance = -500\` directly.

**2. Abstraction**
Expose **what** an object does, hide **how**. Interfaces and abstract classes model the essential behaviour.
Example: a \`PaymentGateway\` interface with \`charge()\`. The caller does not care whether it is Stripe or PayPal.

**3. Inheritance**
A class derives from another and reuses or overrides its behaviour (an "is-a" relationship).
Example: \`Admin extends User\`.
Caveat: deep hierarchies are rigid and fragile (the fragile base class problem). The common advice is **favour composition over inheritance**: build behaviour from smaller collaborating objects.

**4. Polymorphism**
The same interface, different behaviour depending on the concrete type.
- **Subtype (runtime) polymorphism**: \`shape.area()\` calls the right implementation for Circle or Square.
- **Ad-hoc**: method overloading.
- **Parametric**: generics (\`List<T>\`).
Polymorphism lets you replace \`if/switch\` on types with dispatch, and add new types without changing callers (the Open/Closed principle).

In an interview, add a sentence on **when OOP fits** (rich domain models with behaviour and state) and that modern code often mixes it with functional ideas (immutability, pure functions).`,
  },
  {
    id: 'solid',
    category: 'Programming Fundamentals',
    difficulty: 2,
    question: 'What does SOLID stand for?',
    tldr: 'Five design principles for maintainable code: Single responsibility, Open/closed, Liskov substitution, Interface segregation and Dependency inversion.',
    answer: `**S: Single Responsibility Principle**
A module should have **one reason to change**, meaning one actor or stakeholder it serves. An \`Invoice\` class that calculates totals, renders PDFs and sends emails changes for three different reasons, so split it.

**O: Open/Closed Principle**
Open for extension, closed for modification. Add new behaviour by adding code (a new strategy class, plugin or handler) instead of editing a growing \`switch\`.

**L: Liskov Substitution Principle**
Subtypes must be usable wherever the base type is expected **without breaking expectations**. The classic violation: \`Square extends Rectangle\` breaks code that sets width and height independently. Another: a subclass that throws "not supported" for an inherited method.

**I: Interface Segregation Principle**
Clients should not depend on methods they do not use. Prefer small, focused interfaces (\`Readable\`, \`Writable\`) over one fat \`IRepository\` with 30 methods.

**D: Dependency Inversion Principle**
High-level policy should not depend on low-level details. **Both depend on abstractions.** \`OrderService\` depends on an \`OrderRepository\` interface, and Postgres implements it. This makes testing easy (inject a fake) and keeps the domain independent of infrastructure. Dependency *injection* is the usual technique to apply it.

**Senior nuance**: SOLID is a set of heuristics, not laws. Applied dogmatically it produces over-abstracted code (interfaces with one implementation everywhere). Use it where change is likely.`,
  },
  {
    id: 'big-o',
    category: 'Programming Fundamentals',
    difficulty: 2,
    question: 'What is Big O notation? Give examples.',
    tldr: 'Big O describes how an algorithm\'s time or memory grows with input size n, focusing on the dominant term in the worst case and ignoring constants.',
    answer: `Big O is an **upper bound on growth rate**. It lets you compare algorithms independently of hardware. Constants and lower-order terms are dropped: \`3n² + 10n + 7\` is **O(n²)**.

**Common classes (fast → slow)**
- **O(1)**: array access by index, hash map get/put (average).
- **O(log n)**: binary search, balanced BST operations, B-tree index lookups.
- **O(n)**: a single pass over a list, linear search.
- **O(n log n)**: efficient comparison sorts (merge sort, heap sort, average quicksort).
- **O(n²)**: nested loops over the same data, bubble or insertion sort.
- **O(2ⁿ)**: naive recursion over subsets (naive Fibonacci).
- **O(n!)**: brute-force permutations (naive travelling salesman).

**Related ideas**
- **Best / average / worst case**: quicksort is O(n log n) on average but O(n²) in the worst case. Hash maps are O(1) on average but O(n) with many collisions.
- **Amortised**: appending to a dynamic array is O(1) amortised even though an occasional resize is O(n).
- **Space complexity** counts extra memory: recursion depth, auxiliary arrays.

**Practical example**: finding duplicates.
- Compare every pair → O(n²) time, O(1) extra space.
- Sort first → O(n log n) time.
- Use a Set → O(n) time, O(n) space. A classic time/space trade-off.

**Senior nuance**: Big O is not everything. For small n, constants and cache locality dominate, and an "O(n)" loop that does a network call per item is far slower than an O(n log n) in-memory sort.`,
  },

  // =====================================================================
  // NETWORKING & HTTP
  // =====================================================================
  {
    id: 'http-methods',
    category: 'Networking & HTTP',
    difficulty: 1,
    question: 'What HTTP methods do you know? What does it mean for a method to be idempotent?',
    tldr: 'GET reads, POST creates or triggers, PUT replaces, PATCH partially updates, DELETE removes; an idempotent method has the same effect whether it is called once or many times, which makes retries safe.',
    answer: `**Methods**
- **GET**: retrieve a resource. Must not change state. Cacheable.
- **POST**: create a resource or trigger a process. The server picks the new URL (\`201 Created\` + \`Location\` header).
- **PUT**: create or **fully replace** the resource at a known URL.
- **PATCH**: **partially** update a resource (JSON Merge Patch or JSON Patch).
- **DELETE**: remove a resource.
- **HEAD**: like GET but headers only (check existence, size, freshness).
- **OPTIONS**: describe allowed methods; used for CORS preflight.

**Safe** = no side effects on the server: GET, HEAD, OPTIONS.

**Idempotent** = making the same request N times leaves the server in the same state as making it once:
- GET, HEAD, OPTIONS, PUT, DELETE are idempotent.
- \`PUT /users/1 {name: "Ann"}\` twice → same result.
- \`DELETE /users/1\` twice → the user is still gone (the second call may return 404, but the **state** is the same).
- **POST is not idempotent**: two calls may create two orders.
- **PATCH is not guaranteed** idempotent (\`{"op": "increment"}\` is not).

**Why it matters**: networks fail and clients, proxies and load balancers **retry**. Retrying idempotent requests is safe. For POST you need an **idempotency key** so a retried "create payment" does not charge twice.

**Status codes worth knowing**: 200, 201, 204, 301/302/304, 400, 401 (not authenticated), 403 (authenticated but not allowed), 404, 409 (conflict), 422, 429 (rate limited), 500, 502, 503, 504.`,
  },
  {
    id: 'http-url-flow',
    category: 'Networking & HTTP',
    difficulty: 3,
    question: 'What happens when you type a URL into the browser and press Enter?',
    tldr: 'The browser resolves the domain via DNS, opens a TCP (or QUIC) connection, negotiates TLS, sends an HTTP request, the server responds, and the browser parses HTML/CSS/JS into the DOM and CSSOM, lays out and paints the page.',
    answer: `1. **URL parsing and checks**: is it a URL or a search? HSTS preload may force HTTPS. The browser checks its own HTTP cache and service worker first.
2. **DNS resolution**: browser cache → OS cache → configured resolver (ISP, 1.1.1.1), which recursively asks root → TLD (\`.com\`) → authoritative name servers. The result is an IP address (A/AAAA record) with a TTL. Often it points at a CDN edge close to the user.
3. **Connection**:
  - **TCP** 3-way handshake (SYN, SYN-ACK, ACK),
  - **TLS** handshake: certificate validation (chain of trust, hostname), key exchange (ECDHE), session keys. TLS 1.3 takes 1 round trip (0-RTT on resumption),
  - **HTTP/3** uses QUIC over UDP and merges transport and TLS setup.
4. **HTTP request**: \`GET / HTTP/2\` with headers (Host, cookies, Accept, User-Agent…).
5. **Server side**: the CDN may answer from cache. Otherwise: load balancer → reverse proxy → app server → maybe cache/database → response (status, headers such as Cache-Control and Set-Cookie, body, often compressed with gzip/brotli).
6. **Rendering**:
  - parse HTML into the **DOM**; discover CSS, JS and images and fetch them (preload scanner),
  - parse CSS into the **CSSOM**; CSS is render-blocking, and synchronous scripts block parsing (\`defer\`/\`async\` avoid this),
  - combine into the **render tree** → **layout** (geometry) → **paint** → **composite** layers on the GPU,
  - run JavaScript, which may change the DOM and trigger more layout and paint,
  - the \`DOMContentLoaded\` and \`load\` events fire.
7. **Afterwards**: the connection is kept alive for further requests, and resources are cached according to headers.

**Tip**: tailor the depth to the role. Frontend: go deep on rendering and Core Web Vitals. Backend/infra: go deep on DNS, TLS, load balancing and caching.`,
  },
  {
    id: 'rest',
    category: 'Networking & HTTP',
    difficulty: 2,
    question: 'What is a REST API? What makes an API well designed?',
    tldr: 'REST is an architectural style where resources are identified by URLs and manipulated with standard HTTP methods in stateless requests; a good API is consistent, predictable and evolvable.',
    answer: `**REST constraints (Roy Fielding)**
- **Client–server** separation.
- **Stateless**: each request carries everything needed (auth token, parameters), and the server keeps no session state between requests. This makes horizontal scaling easy.
- **Cacheable**: responses declare whether they can be cached.
- **Uniform interface**: resources identified by URIs and manipulated through representations (JSON) with standard methods.
- **Layered system**: clients cannot tell if there are proxies or CDNs in between.
- (Optional) HATEOAS: responses include links to related actions. Rarely done fully in practice.

**Good design practices**
- **Nouns, not verbs**: \`GET /orders/42\`, \`POST /orders\`, not \`/getOrder?id=42\`.
- Plural collections and nesting for ownership: \`/users/7/orders\` (keep nesting shallow).
- **Correct methods and status codes**: 201 + Location on create, 204 on delete, 400/422 for validation, 404, 409 for conflicts.
- **Consistent error format**, e.g. RFC 9457 Problem Details: \`{ type, title, status, detail, errors[] }\`.
- **Pagination** for collections (cursor-based for large or changing data), plus filtering and sorting via query params.
- **Versioning** strategy and backward-compatible evolution.
- **Idempotency keys** for non-idempotent operations like payments.
- Security: HTTPS, authentication (OAuth2/JWT), authorization on every resource, rate limiting.
- Documentation with **OpenAPI**.

**Not everything fits CRUD**: actions like "cancel order" can be modelled as \`POST /orders/42/cancellation\` or a state change \`PATCH /orders/42 {status: "cancelled"}\`.`,
  },
  {
    id: 'cors',
    category: 'Networking & HTTP',
    difficulty: 2,
    question: 'What is CORS and why does it exist?',
    tldr: 'Browsers block JavaScript from reading responses from other origins (Same-Origin Policy); CORS is the header-based mechanism a server uses to explicitly allow specific origins.',
    answer: `**Same-Origin Policy (SOP)**: an origin is **scheme + host + port**. \`https://app.com\` and \`https://api.app.com\` are different origins. By default, a script from one origin cannot **read** responses from another. Otherwise any website you visit could read your bank's API responses using your cookies.

**CORS (Cross-Origin Resource Sharing)** lets the server opt in:
- The browser sends \`Origin: https://app.com\`.
- The server answers \`Access-Control-Allow-Origin: https://app.com\` (or \`*\` for public, credential-less resources).
- With cookies or auth: \`Access-Control-Allow-Credentials: true\`, and the origin **must not** be \`*\`.

**Preflight requests**: for "non-simple" requests (methods other than GET/HEAD/POST, custom headers like \`Authorization\`, or JSON content type), the browser first sends an **OPTIONS** request asking permission. The server replies with \`Access-Control-Allow-Methods\`, \`Access-Control-Allow-Headers\` and \`Access-Control-Max-Age\` (to cache the preflight).

**Key insights**
- CORS is enforced **by the browser**. It does **not** protect your server: curl, Postman and other servers ignore it. Authentication and authorization still matter.
- The request often still **reaches** the server; the browser just hides the response from JS. That is why CSRF protection is a separate concern.
- A CORS error in the console usually means a server configuration issue, not a frontend bug.
- Common fixes: configure allowed origins on the API, or avoid cross-origin calls entirely with a same-origin reverse proxy (\`/api\` → backend).
- Do not blindly reflect any \`Origin\` with credentials allowed; that is effectively disabling the protection.`,
  },

  // =====================================================================
  // BEHAVIORAL
  // =====================================================================
  {
    id: 'soft-about-me',
    category: 'Behavioral',
    difficulty: 1,
    question: 'Tell me about yourself.',
    tldr: 'Give a 60–90 second story: who you are professionally now, one or two relevant achievements, and why this role is your logical next step.',
    answer: `This is not a request for your life story. It is a chance to frame the whole interview, so prepare it and practise it out loud.

**Structure: Present → Past → Future**
1. **Present** (20 s): your current role, the domain, the tech you work with, and the scope of your responsibility.
   *"I'm a backend engineer at a fintech, where I own the payments service, which handles about 2 million transactions a day in Go and PostgreSQL."*
2. **Past** (30–40 s): one or two **achievements relevant to this job**, with numbers.
   *"Recently I led the migration from a monolith to event-driven services, which cut deployment time from 2 hours to 10 minutes. Before that I…"*
3. **Future** (15–20 s): why you are here and how it connects.
   *"I'm looking for a role with more architectural ownership in a product company, and your work on X is exactly the kind of problem I want to solve."*

**Tips**
- Tailor it to the job description; mirror its key skills.
- Concrete beats generic: numbers, scale, impact.
- End with a hook the interviewer can pick up ("happy to go deeper into the migration").
- Keep it under 2 minutes.
- Avoid reciting your CV, personal details unrelated to work, and negativity about current employers.`,
  },
  {
    id: 'soft-conflict',
    category: 'Behavioral',
    difficulty: 2,
    question: 'Tell me about a difficult situation in a team and how you handled it.',
    tldr: 'Use the STAR format with a real, professional (not personal) conflict, focus on what YOU did to understand the other side and resolve it, and finish with a measurable result and a lesson.',
    answer: `**STAR structure**
- **Situation**: brief context. Team, project, what was at stake.
- **Task**: your role and responsibility.
- **Action**: what **you** did, step by step. This is 60% of the answer. Say "I", not "we".
- **Result**: outcome, ideally measurable, plus what you learned or changed afterwards.

**What interviewers look for**
- You seek to **understand** the other perspective before arguing.
- You move the discussion from opinions to **data** (benchmarks, prototypes, user impact).
- You escalate appropriately, not too early and not never.
- You stay respectful and keep the relationship intact.
- You can **disagree and commit** when the decision goes the other way.

**Example skeleton**
*"Two senior engineers on my team disagreed about whether to adopt GraphQL. Reviews turned into long comment wars and the feature was blocked for a week (S). As tech lead I needed us to unblock delivery (T). I set up a 1:1 with each to understand their concerns: one cared about frontend flexibility, the other about caching and operational complexity. I proposed a time-boxed spike with agreed criteria (latency, complexity, effort) and facilitated a review of the results (A). We chose a BFF with REST, both felt heard, and the feature shipped two weeks later. I also introduced lightweight ADRs so future decisions do not happen in PR comments (R)."*

**Avoid**: stories where the other person is simply an idiot, conflicts you did not resolve and learned nothing from, and very personal or emotional conflicts.

Prepare 4–5 STAR stories (conflict, failure, leadership, tight deadline, influencing without authority) and adapt them to different questions.`,
  },
  {
    id: 'soft-why-us',
    category: 'Behavioral',
    difficulty: 1,
    question: 'Why do you want to work at our company?',
    tldr: 'Show that you did your research: connect something specific about their product, tech or mission to your experience and to what you want to grow into.',
    answer: `**Bad answers**: "I need a job", "good salary", "you're a big company", or anything that fits every company.

**A strong answer has three parts**
1. **Specific about them**: their product, users, technical challenges (read the engineering blog, talks, job ad, GitHub), market position, culture or values.
   *"I read your post about moving search to an event-driven architecture…"*
2. **Fit with you**: how your experience helps solve **their** problems.
   *"I did a similar migration at X and ran into the same consistency issues around reindexing."*
3. **Growth**: what you want to learn and where you want to go, and why this role enables it.
   *"I'd like to work at larger scale and get more involved in architecture decisions."*

**Research checklist**: product (try it if you can), engineering blog and talks, tech stack, recent news and funding, Glassdoor-style reviews, the interviewers' LinkedIn profiles, the team you would join.

It also helps to prepare a short answer to "what do you know about us?" and good questions to ask at the end. Genuine curiosity is one of the strongest signals you can send.`,
  },
]);
