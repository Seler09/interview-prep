/*
  SENIOR: SECURITY, TESTING, DEVOPS, PERFORMANCE, ALGORITHMS, LEADERSHIP
  Format: see the comment at the top of questions.js
*/
addQuestions('senior', [
  // =====================================================================
  // SECURITY
  // =====================================================================
  {
    id: 'sec-owasp',
    category: 'Security',
    difficulty: 2,
    question: 'What are the most important risks from the OWASP Top 10 and how do you defend against them?',
    tldr: 'Broken access control, injection, cryptographic failures, insecure design, misconfiguration, vulnerable dependencies, authentication failures, integrity failures, logging gaps and SSRF; the defences are server-side authorisation on every resource, parameterised queries, secure defaults, dependency hygiene and monitoring.',
    answer: `**A01 Broken Access Control** (the #1 risk)
- IDOR: \`GET /api/invoices/1043\` returns someone else's invoice because only authentication is checked.
- Missing function-level checks (a normal user calling admin endpoints), privilege escalation via mass assignment (\`{ "role": "admin" }\` in a profile update).
- Defence: **deny by default**, check ownership or permissions **on the server for every resource**, centralise authorisation (policies), never trust IDs or roles coming from the client.
\`\`\`js
app.get('/api/invoices/:id', auth, async (req, res) => {
  const invoice = await db.invoices.findOne({ id: req.params.id, tenantId: req.user.tenantId });
  if (!invoice) return res.sendStatus(404);          // 404 rather than 403 avoids leaking existence
  res.json(invoice);
});
\`\`\`

**A03 Injection** (SQL, NoSQL, OS command, LDAP; XSS is also injection)
\`\`\`js
// ✘ vulnerable
db.query(\`SELECT * FROM users WHERE email = '\${email}'\`);
// ✔ parameterised
db.query('SELECT * FROM users WHERE email = $1', [email]);
\`\`\`
Also: never build shell commands from input (\`execFile\` with argument arrays instead of \`exec\`), validate input against allow-lists.

**A02 Cryptographic Failures**: TLS everywhere (HSTS), encrypt sensitive data at rest, modern algorithms, proper password hashing (Argon2id/bcrypt), no home-made crypto, no secrets in code.

**A04 Insecure Design**: missing threat modelling and abuse cases (unlimited password reset attempts, business-logic flaws). Do threat modelling (STRIDE) for new features.

**A05 Security Misconfiguration**: default credentials, verbose stack traces in production, open S3 buckets, permissive CORS, missing security headers (CSP, \`X-Content-Type-Options\`, \`frame-ancestors\`).

**A06 Vulnerable and Outdated Components**: dependency scanning (Dependabot, Renovate, Snyk, \`npm audit\`), SBOMs, pinned versions and lockfiles, timely patching.

**A07 Identification and Authentication Failures**: credential stuffing → rate limiting, MFA, breached-password checks; secure session handling (rotation on login, secure cookie flags, timeouts).

**A08 Software and Data Integrity Failures**: unsigned updates, insecure CI/CD pipelines, unsafe deserialisation. Verify signatures, protect pipelines, pin GitHub Actions to SHAs.

**A09 Security Logging and Monitoring Failures**: log auth events and access-control failures (without secrets or PII), alert on anomalies, keep audit trails.

**A10 SSRF**: the server fetches a user-supplied URL and is tricked into hitting internal services or cloud metadata (\`169.254.169.254\`). Defence: allow-list destinations, resolve DNS and block private ranges, use a dedicated egress proxy, IMDSv2 in AWS.`,
  },
  {
    id: 'sec-xss-csrf',
    category: 'Security',
    difficulty: 2,
    question: 'Explain XSS and CSRF and how to defend against them.',
    tldr: 'XSS injects attacker-controlled script into your page (defend with context-aware output encoding, sanitisation, CSP and HttpOnly cookies); CSRF makes the victim\'s browser send authenticated requests from another site (defend with SameSite cookies, anti-CSRF tokens and Origin checks).',
    answer: `**XSS: Cross-Site Scripting**: the attacker's JavaScript runs in your origin, with access to the DOM, session-bound API calls, and tokens stored in JS-accessible storage.
- **Stored**: a malicious comment saved in the DB is shown to every visitor.
- **Reflected**: a payload in a URL parameter is echoed back in the response.
- **DOM-based**: client-side JS writes untrusted data into dangerous sinks (\`innerHTML\`, \`eval\`, \`location\`, \`setAttribute('href', ...)\` with \`javascript:\`).

Defences:
\`\`\`js
// ✘ dangerous sink
el.innerHTML = userComment;
// ✔ text, not HTML
el.textContent = userComment;
// ✔ if you must render user HTML, sanitise it
import DOMPurify from 'dompurify';
el.innerHTML = DOMPurify.sanitize(userHtml);
\`\`\`
- Frameworks escape by default (React, Angular, Vue); the danger is in escape hatches: \`dangerouslySetInnerHTML\`, \`v-html\`, \`bypassSecurityTrust*\`, and \`href={userUrl}\` without checking the protocol.
- **Content Security Policy** as defence in depth:
\`\`\`http
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-r4nd0m'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
\`\`\`
- Session cookies with \`HttpOnly\` so scripts cannot read them (XSS can still *use* the session, so it remains critical).
- Trusted Types (Chromium) to lock down DOM sinks.

**CSRF: Cross-Site Request Forgery**: a malicious site makes the victim's browser send a request to your app, and the browser **automatically attaches cookies**.
\`\`\`html
<!-- on evil.com -->
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="attacker"><input name="amount" value="5000">
</form>
<script>document.forms[0].submit()</script>
\`\`\`
Defences:
- **SameSite cookies**: \`Lax\` (the default in modern browsers) blocks cookies on cross-site POSTs; \`Strict\` blocks all cross-site sends.
\`\`\`http
Set-Cookie: session=abc; Secure; HttpOnly; SameSite=Lax; Path=/
\`\`\`
- **Anti-CSRF tokens** (synchronizer token or double-submit cookie) for cookie-authenticated, state-changing requests.
- Verify the \`Origin\` / \`Sec-Fetch-Site\` headers on state-changing requests.
- Never change state with GET.
- APIs authenticated with a bearer token in the \`Authorization\` header are not CSRF-prone (the browser does not add it automatically), but then the token must not be stealable via XSS.`,
  },
  {
    id: 'sec-jwt-sessions',
    category: 'Security',
    difficulty: 3,
    question: 'JWT or server-side sessions? What are the pitfalls of JWT?',
    tldr: 'Server-side sessions are simple and instantly revocable; JWTs are self-contained and verifiable without a lookup, which helps across services, but are hard to revoke, so keep them short-lived with rotated refresh tokens, pin the algorithm, and store them safely.',
    answer: `**Server-side sessions**
- A random, opaque session ID in a cookie (\`HttpOnly; Secure; SameSite\`); session data lives in a store (Redis/DB).
- ✔ Instant revocation (logout, ban, password change), small cookie, nothing sensitive on the client, simple mental model.
- ✘ Requires a shared session store (a lookup per request), which is fine for most web apps.

**JWT (JSON Web Token)**: \`header.payload.signature\`, base64url-encoded, **signed** (HS256 with a shared secret, or RS256/ES256 with a private key).
- ✔ Stateless verification: any service holding the public key can validate it without a DB call. Good for service-to-service auth and federated identity (OIDC ID tokens).
- ✘ **Cannot be revoked** before expiry without extra state.

**Pitfalls and how to handle them**
- **Revocation** → short-lived access tokens (5–15 min) + **refresh tokens** that are stored server-side, **rotated** on each use, with **reuse detection** (if an old refresh token is used again, revoke the whole family). Optionally a deny-list of token IDs (\`jti\`) for emergencies.
- **Algorithm confusion** → never trust the \`alg\` header; pin the expected algorithm and key.
\`\`\`js
import { jwtVerify, createRemoteJWKSet } from 'jose';
const JWKS = createRemoteJWKSet(new URL('https://auth.example.com/.well-known/jwks.json'));
const { payload } = await jwtVerify(token, JWKS, {
  algorithms: ['RS256'],                 // reject "none" / HS256 confusion attacks
  issuer: 'https://auth.example.com',
  audience: 'orders-api',
  clockTolerance: 30,
});
\`\`\`
- **Validate claims**: \`exp\`, \`nbf\`, \`iss\`, \`aud\`; do not accept a token meant for another service.
- **The payload is not encrypted**, only encoded. No secrets or sensitive personal data in it (or use JWE).
- **Storage in the browser**: \`localStorage\` is readable by any XSS. Prefer \`HttpOnly\` cookies (then handle CSRF), or keep the access token in memory and the refresh token in an HttpOnly cookie.
- **Token bloat**: big JWTs with many roles are sent on every request.
- **Stale claims**: roles in the token stay valid until expiry even if permissions changed.

**Recommendation**: for a classic web application (one backend, browser clients) **sessions are usually simpler and safer**. Use JWTs where statelessness matters: microservices behind a gateway, third-party API access, OIDC. A common hybrid: session cookie at the edge (BFF), short-lived JWT internally.`,
  },
  {
    id: 'sec-oauth',
    category: 'Security',
    difficulty: 3,
    question: 'Explain OAuth 2.0 and OpenID Connect. What is PKCE?',
    tldr: 'OAuth 2.0 is for delegated authorisation (an app gets an access token to call APIs on the user\'s behalf); OpenID Connect adds authentication on top with an ID token; PKCE protects the authorization code flow from code interception and is now recommended for all clients.',
    answer: `**Roles**: resource owner (the user), client (your app), authorization server (Auth0, Keycloak, Entra ID, Google), resource server (the API).

**OAuth 2.0 = authorisation (delegation)**. The client obtains an **access token** with specific **scopes** ("read calendar") without ever seeing the user's password. The access token is meant for the **API**, not for the client to identify the user.

**OpenID Connect = authentication**, built on OAuth 2.0. It adds the **ID token** (a JWT with \`sub\`, \`iss\`, \`aud\`, \`exp\`, \`nonce\`, and user claims), the \`openid\` scope, a \`/userinfo\` endpoint, and discovery (\`/.well-known/openid-configuration\`). "Sign in with Google" is OIDC.

**Authorization Code flow + PKCE** (the standard for web, SPA and mobile apps)
1. The client creates a random \`code_verifier\` and its hash \`code_challenge = BASE64URL(SHA256(verifier))\`.
2. It redirects the user to the authorization server:
\`\`\`text
GET https://auth.example.com/authorize?
    response_type=code&client_id=web-app&redirect_uri=https://app.example.com/callback
    &scope=openid%20profile%20orders:read&state=af0ifjsldkj&nonce=n-0S6_WzA2Mj
    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256
\`\`\`
3. The user logs in and consents; the server redirects back with \`?code=...&state=...\`.
4. The client checks \`state\` (CSRF protection) and exchanges the code at the token endpoint, sending the **original \`code_verifier\`**:
\`\`\`http
POST /token
grant_type=authorization_code&code=SplxlOBeZQQYbYS6WxSbIA&redirect_uri=https://app.example.com/callback
&client_id=web-app&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
\`\`\`
5. The server verifies \`SHA256(verifier) == challenge\` and returns access, refresh and ID tokens.

**Why PKCE**: public clients (SPAs, mobile) cannot keep a client secret. If an attacker intercepts the authorization code (malicious app with the same redirect scheme, logs, referrer leaks), they cannot redeem it without the verifier. OAuth 2.1 makes PKCE mandatory for all clients.

**Other grants**
- **Client Credentials**: machine-to-machine, no user.
- **Device Authorization**: TVs and CLIs.
- **Refresh token** grant.
- **Deprecated**: Implicit (tokens in the URL fragment) and Resource Owner Password Credentials.

**Security checklist**: exact redirect URI matching, validate \`state\` and \`nonce\`, validate ID token signature and claims, least-privilege scopes, short-lived tokens, refresh token rotation, and for SPAs consider the **BFF pattern** (tokens kept server-side, browser gets a session cookie).`,
  },
  {
    id: 'sec-passwords-secrets',
    category: 'Security',
    difficulty: 2,
    question: 'How do you store user passwords and application secrets?',
    tldr: 'Passwords: never encrypt or use fast hashes; use a slow, salted, memory-hard algorithm like Argon2id (or bcrypt). Secrets: keep them out of code and images, in a secret manager with least privilege, short-lived credentials and rotation.',
    answer: `**User passwords**
- Never store plaintext or reversibly encrypted passwords, and never use fast hashes (MD5, SHA-1, SHA-256): GPUs compute billions per second.
- Use a **slow, salted, adaptive** algorithm: **Argon2id** (preferred, memory-hard), **bcrypt** (cost ≥ 10–12; note its 72-byte input limit), scrypt, or PBKDF2 for FIPS environments.
- A unique random **salt** per password (libraries handle this and embed it in the hash string), which defeats rainbow tables.
- Optional **pepper**: a secret key kept outside the DB (in a KMS/HSM), so a DB dump alone is not enough.
- Re-hash on login when parameters are upgraded.
\`\`\`js
import argon2 from 'argon2';
const hash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2 });
// stored: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
const ok = await argon2.verify(hash, attempt);    // constant-time comparison inside
\`\`\`
- Around it: rate limiting and lockout or backoff, MFA (TOTP, WebAuthn/passkeys), checking new passwords against breached lists (Have I Been Pwned k-anonymity API), reasonable rules (length over complexity), no password hints, generic error messages.

**Application secrets** (DB passwords, API keys, signing keys)
- Never commit them to git or bake them into Docker images or frontend bundles. Add secret scanning (gitleaks, GitHub push protection) to catch mistakes.
- Store them in a **secret manager**: HashiCorp Vault, AWS Secrets Manager / SSM, GCP Secret Manager, Azure Key Vault. Inject at runtime (env vars or mounted files), with **least-privilege** access per service.
- Prefer **short-lived, automatically issued credentials** over long-lived keys: cloud IAM roles for workloads, Vault dynamic DB credentials, and **OIDC federation from CI to the cloud** instead of static access keys in CI.
\`\`\`yaml
# GitHub Actions → AWS without stored keys
permissions: { id-token: write, contents: read }
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/deploy
      aws-region: eu-central-1
\`\`\`
- **Rotation** on a schedule and immediately on suspicion. A leaked secret must be **rotated**, not just deleted from git history (it is already in clones and caches).
- Encrypt data with envelope encryption (KMS data keys), and audit secret access.`,
  },

  // =====================================================================
  // TESTING & QUALITY
  // =====================================================================
  {
    id: 'test-strategy',
    category: 'Testing & Quality',
    difficulty: 2,
    question: 'How do you build a testing strategy for a project? Test pyramid vs testing trophy.',
    tldr: 'Aim for the most confidence per unit of cost: static analysis as the base, many fast unit tests for logic, a strong layer of integration tests against real dependencies, contract tests between services and a few end-to-end tests for critical journeys, all fast and deterministic.',
    answer: `**Test pyramid** (Mike Cohn): many unit tests, fewer integration tests, very few end-to-end tests, because higher levels are slower, flakier and more expensive.

**Testing trophy** (Kent C. Dodds): static analysis at the base, then unit, then a **thick integration layer**, then a few E2E. Integration tests give the best confidence-to-cost ratio, especially for UI and service code that is mostly glue.

**Practical strategy**
- **Static**: TypeScript or type checkers, linters, formatters, security scanners. Cheap, catches whole classes of bugs.
- **Unit tests**: pure domain logic, algorithms, edge cases. Milliseconds each, run on every save.
- **Integration tests**: your service with **real** dependencies where practical: a real database via **Testcontainers**, an HTTP layer with an in-process server, a real message broker. Mock only external third parties.
\`\`\`ts
// Testcontainers + Vitest: test the repository against a real Postgres
let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16').start();
  await migrate(container.getConnectionUri());
}, 60_000);
afterAll(() => container.stop());

test('finds orders by customer, newest first', async () => {
  const repo = new PgOrderRepository(container.getConnectionUri());
  await repo.save(order({ customerId: 'c1', createdAt: '2026-01-01' }));
  await repo.save(order({ customerId: 'c1', createdAt: '2026-02-01' }));
  const result = await repo.findByCustomer('c1');
  expect(result.map(o => o.createdAt)).toEqual(['2026-02-01', '2026-01-01']);
});
\`\`\`
- **Contract tests** (Pact, or schema checks) between services, so breaking API changes fail in CI rather than in production.
- **E2E tests** (Playwright, Cypress) only for **critical user journeys**: sign-up, login, checkout, payment.
- **Non-functional**: load tests (k6) for hot paths, security tests (DAST), accessibility checks (axe).

**Principles**
- Test **behaviour through public interfaces**, not implementation details, so refactoring does not break tests.
- Tests must be **fast and deterministic**; otherwise people stop running and trusting them.
- Coverage is a signal, not a goal (100% coverage with weak assertions proves little). **Mutation testing** (Stryker, PIT) measures how good the tests are.
- Shift-left: tests run on every PR, and the main branch is always releasable.
- In production: monitoring, synthetic checks, canary releases. Testing does not stop at deploy.`,
  },
  {
    id: 'test-doubles',
    category: 'Testing & Quality',
    difficulty: 2,
    question: 'Mock, stub, fake, spy: what is the difference, and when does mocking hurt?',
    tldr: 'Stubs return canned answers, mocks verify interactions, spies record calls on real behaviour and fakes are lightweight working implementations; over-mocking couples tests to implementation and lets tests pass while production fails.',
    answer: `**Test doubles (Gerard Meszaros' terms)**
- **Dummy**: passed around but never used (fills a parameter).
- **Stub**: returns predefined answers ("\`getRate()\` returns 4.2"). Used to **drive** the code under test.
- **Spy**: records how it was called (often wrapping a real implementation) so you can assert afterwards.
- **Mock**: pre-programmed with **expectations** about calls; the test fails if they are not met. Used to verify **interactions**.
- **Fake**: a real but simplified implementation: an in-memory repository, a fake payment gateway, an SMTP sink.

\`\`\`ts
// stub: control an input
const rates = { getRate: vi.fn().mockResolvedValue(4.2) };

// spy/mock: verify an important side effect at a boundary
const mailer = { send: vi.fn() };
await registerUser({ email: 'a@x.io' }, { mailer, users: new InMemoryUserRepo() }); // fake repo
expect(mailer.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@x.io', template: 'welcome' }));
\`\`\`

**When mocking hurts**
- **Testing implementation, not behaviour**: asserting that \`repo.findById\` was called exactly once with these args. Any refactoring breaks the test although behaviour is unchanged.
- **Mocking what you don't own**: mocking an ORM, HTTP client or SDK encodes *your assumptions* about it. When reality differs, tests are green and production breaks. Wrap third-party libraries in your own adapter (a port) and test the adapter with integration tests.
- **Mock drift**: the mocked contract diverges from the real service over time (contract tests fix this).
- **Deep mock chains** (\`a.b().c().d()\`) are a design smell, a sign of too much coupling.
- **Mocks returning mocks**: the test becomes a mirror of the code and verifies nothing.

**Guidelines**
- Mock at **architectural boundaries**: network, third-party APIs, time (inject a clock), randomness, the file system.
- Inside your own code, use real objects or **fakes**; they make tests both faster and more realistic.
- Prefer **state verification** (check the result or resulting state) over **interaction verification**, except for side effects that are the point (an email sent, an event published).`,
  },
  {
    id: 'test-flaky',
    category: 'Testing & Quality',
    difficulty: 2,
    question: 'What do you do about flaky tests?',
    tldr: 'Treat flakiness as a bug: detect and track flaky tests, quarantine them with an owner so they stop blocking CI, then fix the root cause (time, ordering, shared state, async waits, external dependencies or a real race in the code), not just add retries.',
    answer: `**Why it matters**: flaky tests destroy trust in CI. People start re-running pipelines and ignoring red builds, and then real failures slip through. They also waste a lot of CI time.

**Process**
1. **Detect**: CI analytics (failure rate per test, pass-on-retry statistics), tools like BuildPulse, Datadog CI Visibility or Gradle Enterprise, or run suspicious tests many times (\`--repeat-each=50\` in Playwright, \`-count=100\` in Go).
2. **Quarantine**: move or mark the test so it does not block merges, but still runs and reports, with a **ticket and an owner** and a deadline. Quarantine must not become a graveyard.
3. **Fix the root cause.**

**Common root causes and fixes**
- **Time**: tests depend on \`now()\`, timezones, DST or midnight. Inject a clock or use fake timers; fix the timezone in CI.
- **Randomness**: random data without a seed. Log or fix the seed.
- **Order dependence and shared state**: tests pass alone and fail together (shared DB rows, global singletons, caches, environment variables). Isolate the data (unique IDs per test, a transaction rolled back after each test, fresh containers), and run tests in random order to expose it.
- **Async waiting**: fixed \`sleep(500)\` instead of waiting for a condition.
\`\`\`ts
// ✘ flaky
await page.click('#save'); await page.waitForTimeout(1000);
expect(await page.textContent('.toast')).toBe('Saved');
// ✔ web-first assertion: retries until it passes or times out
await page.getByRole('button', { name: 'Save' }).click();
await expect(page.getByText('Saved')).toBeVisible();
\`\`\`
- **External dependencies**: real network calls or third-party sandboxes. Stub them at the boundary or use local containers.
- **Resource limits**: CPU-starved CI runners, port collisions, too much parallelism.
- **Real concurrency bugs in production code**: sometimes the flaky test is right! Investigate before blaming the test.

**Policies**: automatic retries can be a temporary mitigation, but always report "passed on retry" as flaky and do not let it hide the problem; track the flaky-test rate as a team metric.`,
  },
  {
    id: 'quality-code-review',
    category: 'Testing & Quality',
    difficulty: 1,
    question: 'What makes a good code review, both as an author and as a reviewer?',
    tldr: 'Small, well-described PRs from authors; timely reviews that focus on correctness, design and maintainability (leaving style to tools), written as kind, specific suggestions with clear severity, and used as a way to share knowledge.',
    answer: `**As an author**
- Keep PRs **small and focused** (ideally < 400 lines changed). Large PRs get superficial reviews.
- Write a description: **why** the change, what it does, how it was tested, screenshots for UI, risks and rollout notes.
- Self-review the diff first; run tests and linters locally.
- Split refactoring from behaviour changes (separate commits or PRs).
- Discuss big design decisions **before** implementation (design doc, quick sync), not in the PR afterwards.

**As a reviewer: priorities**
1. **Correctness**: does it do what it should? Edge cases, error handling, concurrency, data migrations, backward compatibility.
2. **Security and privacy**: authorisation checks, injection, secrets, PII in logs.
3. **Design and maintainability**: right place for the logic, coupling, naming, unnecessary complexity, consistency with the codebase.
4. **Tests**: do they cover the behaviour and edge cases? Would they catch a regression?
5. **Operability**: logging, metrics, feature flags, performance implications (N+1, unbounded queries).
6. **Style and formatting**: automate with linters and formatters, not human comments.

**How to comment**
- Be kind and specific; comment on the code, not the person.
- Ask questions rather than issue orders: "What happens if \`items\` is empty here?"
- Label severity so the author knows what blocks the merge:
\`\`\`text
blocking: this query runs once per order line (N+1). Could we batch it with WHERE id = ANY($1)?
suggestion: extracting this into a PricingPolicy would make the discount rules testable.
nit: typo in the variable name.
praise: nice use of a discriminated union here, the exhaustive switch makes this safe.
\`\`\`
- Explain the "why" and link docs. Reviews are one of the best mentoring tools.
- Approve with minor comments when appropriate; do not block on personal preference.

**Team practices**: review within hours, not days (long waits kill flow and increase merge conflicts); rotate reviewers to spread knowledge; checklists for risky areas; pair programming as an alternative for complex changes.`,
  },

  // =====================================================================
  // DEVOPS & OBSERVABILITY
  // =====================================================================
  {
    id: 'ops-deploy-strategies',
    category: 'DevOps & Observability',
    difficulty: 2,
    question: 'What deployment strategies do you know? Rolling, blue-green, canary, feature flags.',
    tldr: 'Rolling replaces instances gradually, blue-green switches all traffic between two environments, canary shifts a small percentage first and watches metrics, and feature flags separate deploying code from releasing features; all of them need backward-compatible changes.',
    answer: `**Recreate**: stop the old version, start the new one. Downtime; only for dev or batch systems.

**Rolling update**: replace instances in batches (the Kubernetes Deployment default).
\`\`\`yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 25%        # extra pods during the rollout
    maxUnavailable: 0    # never drop below the desired capacity
\`\`\`
- ✔ No extra environment, zero downtime with good readiness probes.
- ✘ Old and new versions serve traffic **at the same time**, so APIs, events and DB schema must be compatible both ways; rollback is another rolling update.

**Blue-green**: two identical environments; deploy to the idle one (green), test it, then switch the router or load balancer.
- ✔ Instant switch and instant rollback, full testing before go-live.
- ✘ Double capacity during the switch; the **database is usually shared**, so schema changes still need expand/contract; long-lived connections and caches need care.

**Canary**: route a small slice of real traffic (1% → 5% → 25% → 100%) to the new version, compare its error rate and latency with the baseline, and roll back automatically if they degrade (Argo Rollouts, Flagger, Spinnaker, cloud LBs).
- ✔ Limits the blast radius with real production traffic.
- ✘ Needs good metrics and enough traffic for statistical confidence; sticky sessions can matter.

**Feature flags**: deploy code switched off, then **release** independently: to employees, a percentage of users, specific tenants, or in a region.
\`\`\`ts
if (await flags.isEnabled('new-checkout', { userId: user.id, country: user.country })) {
  return newCheckout(cart);
}
return legacyCheckout(cart);
\`\`\`
- ✔ Decouples deploy from release, enables trunk-based development, A/B tests, **kill switches** for risky features, gradual rollouts.
- ✘ Flag debt: every flag doubles code paths. Give flags owners and expiry dates, and remove them after rollout. Test both states.

**Related**: **shadow traffic / dark launches** (mirror requests to the new version and discard responses), **A/B testing** (product experiments, not a deployment safety mechanism), **ring deployments** (internal → beta → everyone).

**Prerequisites for all of them**: health and readiness checks, graceful shutdown, automated rollback criteria, observability, and backward-compatible changes.`,
  },
  {
    id: 'ops-observability',
    category: 'DevOps & Observability',
    difficulty: 2,
    question: 'What is observability? Explain logs, metrics and traces.',
    tldr: 'Observability is the ability to understand a system\'s internal state, including problems you did not anticipate, from its outputs: metrics for cheap aggregated trends and alerting, structured logs for detailed events, and distributed traces for following a request across services, all correlated by IDs.',
    answer: `**Monitoring vs observability**: monitoring answers known questions ("is CPU > 90%?"); observability lets you ask **new** questions during an incident ("why are only Android users in Germany on version 4.2 seeing slow checkouts?").

**Metrics**: numeric time series (counters, gauges, histograms) with labels.
- Cheap to store and query; ideal for dashboards, SLOs and **alerting**.
- **RED** for request-driven services: **R**ate, **E**rrors, **D**uration (as histograms → p50/p95/p99, never just averages).
- **USE** for resources: **U**tilisation, **S**aturation, **E**rrors (CPU, memory, disk, connection pools, queues).
- Beware **high cardinality**: never use user IDs or URLs with IDs as label values; it explodes storage.

**Logs**: discrete events with context.
- **Structured** (JSON) so they can be queried; consistent field names; correct log levels.
- Always include a **trace ID / request ID** for correlation.
- No secrets or unnecessary PII; sampling or retention policies to control cost.
\`\`\`json
{"ts":"2026-11-10T12:00:01Z","level":"error","service":"checkout","trace_id":"4bf92f3577b34da6",
 "user_tier":"premium","msg":"payment declined","provider":"stripe","error_code":"card_declined","duration_ms":812}
\`\`\`

**Distributed traces**: a request's journey as a tree of **spans** across services, with timing and attributes. They show where latency comes from (which downstream call, which DB query) and how errors propagate. Context is propagated through headers (W3C \`traceparent\`).

**OpenTelemetry** is the vendor-neutral standard (SDKs + Collector) for all three signals; backends include Prometheus/Grafana, Loki, Tempo/Jaeger, Datadog, Honeycomb, New Relic.
\`\`\`ts
const tracer = trace.getTracer('checkout');
await tracer.startActiveSpan('charge-card', async span => {
  span.setAttribute('payment.provider', 'stripe');
  try { return await stripe.charge(order); }
  catch (e) { span.recordException(e); span.setStatus({ code: SpanStatusCode.ERROR }); throw e; }
  finally { span.end(); }
});
\`\`\`

**Also**: continuous profiling (CPU and memory flame graphs in production), RUM (real user monitoring) on the frontend, synthetic checks, and **alert on symptoms users feel** (error rate, latency SLO burn) rather than on every cause (CPU at 80%), with runbooks linked from alerts.`,
  },
  {
    id: 'ops-slo',
    category: 'DevOps & Observability',
    difficulty: 2,
    question: 'Explain SLI, SLO, SLA and error budgets.',
    tldr: 'An SLI is a measured indicator of service quality, an SLO is the internal target for it, an SLA is a contractual promise with penalties (looser than the SLO), and the error budget (100% − SLO) is the amount of unreliability you can spend on shipping changes.',
    answer: `**SLI (Service Level Indicator)**: a ratio of good events to valid events, measured as close to the user as possible.
- Availability: successful requests / all requests (5xx count as bad).
- Latency: requests served faster than 300 ms / all requests.
- Also freshness (data younger than X), correctness, durability.

**SLO (Service Level Objective)**: the target for an SLI over a window, e.g. "99.9% of checkout requests succeed over a rolling 30 days" or "95% of searches complete in < 200 ms".
- Choose targets based on what users actually need, not "as high as possible".

**SLA (Service Level Agreement)**: an external contract with consequences (credits, refunds) if missed. Always **looser** than the internal SLO so you get warned first.

**Error budget = 100% − SLO**
\`\`\`text
99.9%  over 30 days → 0.1%  ≈ 43 minutes of "badness"
99.95% over 30 days         ≈ 21.6 minutes
99.99% over 30 days         ≈ 4.3 minutes
\`\`\`
- Budget remaining → ship features, experiment, take risks.
- Budget exhausted → prioritise reliability work, slow or freeze risky releases. This turns the dev-vs-ops argument into a data-driven agreement.

**Why not 100%**: unattainable (dependencies, networks and user devices fail), exponentially expensive, and it blocks all change. Each extra nine costs roughly 10× more.

**Alerting on burn rate** (Google SRE workbook): page when the budget is being consumed fast, e.g. a burn rate of 14.4 over 1 h (and confirmed over 5 min) means the monthly budget would be gone in about 2 days. Slow burns create tickets instead of pages. This catches real user impact while avoiding noisy alerts.

\`\`\`promql
# fraction of failed requests over the last hour (availability SLI)
sum(rate(http_requests_total{job="checkout",code=~"5.."}[1h]))
/
sum(rate(http_requests_total{job="checkout"}[1h]))
\`\`\``,
  },
  {
    id: 'ops-incident',
    category: 'DevOps & Observability',
    difficulty: 2,
    question: 'Production is down. How do you run the incident?',
    tldr: 'Declare the incident and assign roles, assess impact, mitigate first (roll back, disable the flag, fail over), communicate regularly, keep a timeline, and afterwards run a blameless postmortem with concrete, owned action items.',
    answer: `**During the incident**
1. **Declare it early** and open a dedicated channel or call. Assign roles:
   - **Incident Commander**: coordinates, makes decisions, does not debug.
   - **Communications lead**: status page, stakeholders, customer support.
   - **Operations / subject-matter experts**: investigate and apply fixes.
   - A scribe keeps the **timeline**.
2. **Assess impact and severity**: who is affected, how many, since when, what is broken (dashboards, SLOs, error rates, support tickets).
3. **Mitigate first, root-cause later.** The goal is to stop user impact as fast as possible:
   - roll back the last deploy or config change (most incidents are caused by changes),
   - disable the feature flag, fail over to another region or replica, scale up, rate-limit or shed load, block an abusive client.
   - "What changed recently?" is the first question.
4. **Communicate on a fixed cadence** (e.g. every 30 minutes), even if there is no news: impact, what we are doing, next update time.
5. **Verify recovery** with metrics, then declare it resolved, then monitor.

\`\`\`bash
# typical first moves in Kubernetes
kubectl rollout history deployment/checkout
kubectl rollout undo deployment/checkout            # back to the previous revision
kubectl scale deployment/checkout --replicas=20
kubectl logs -l app=checkout --since=15m | grep -i error | head
\`\`\`

**After the incident: blameless postmortem** (within a few days)
- **Summary and impact** (duration, users and revenue affected, SLO budget consumed).
- **Timeline** of detection, response and resolution.
- **Root cause and contributing factors**: use "5 Whys" or a causal analysis; usually several factors (a bug + a missing alert + a risky deploy process).
- What went well, what went badly, where we got lucky.
- **Action items** with owners and due dates: prevention (tests, guardrails, validation), detection (better alerts), mitigation (faster rollback, runbooks).

**Blameless culture**: ask "how did our system allow this to happen?", not "who did it?". If people fear blame, they hide information and the organisation stops learning.

**Preparation**: on-call rotation with sane load, runbooks linked from alerts, practised rollbacks, game days and chaos engineering.`,
  },
  {
    id: 'ops-containers-k8s',
    category: 'DevOps & Observability',
    difficulty: 2,
    question: 'Containers vs VMs. Key Kubernetes objects and common pitfalls.',
    tldr: 'Containers share the host kernel and isolate processes with namespaces and cgroups (lightweight, fast to start), VMs virtualise hardware with their own kernel (stronger isolation). In Kubernetes, know Pods, Deployments, Services, Ingress, ConfigMaps/Secrets and HPA, and get resources, probes and graceful shutdown right.',
    answer: `**Containers vs VMs**
- **Container**: an isolated process using Linux **namespaces** (PID, network, mount…) and **cgroups** (CPU and memory limits), sharing the host kernel. Starts in milliseconds to seconds, small footprint, packaged as an image.
- **VM**: a full guest OS with its own kernel on a hypervisor. Stronger isolation, heavier and slower to start.
- Sandboxed runtimes (gVisor, Kata, Firecracker microVMs) sit in between for multi-tenant isolation.

**Good images**
\`\`\`dockerfile
# multi-stage build: small final image, no build tools inside
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node                       # do not run as root
EXPOSE 3000
CMD ["node", "dist/server.js"]  # exec form, so the process receives SIGTERM
\`\`\`

**Kubernetes building blocks**
- **Pod**: one or more containers sharing network and volumes; ephemeral.
- **Deployment**: desired number of replicas plus rolling updates; **StatefulSet** for stable identity and storage; **DaemonSet** for one pod per node; **Job / CronJob** for batch work.
- **Service**: stable virtual IP / DNS name load-balancing to pods; **Ingress / Gateway API** for HTTP routing from outside.
- **ConfigMap / Secret**: configuration (Secrets are only base64-encoded by default, so enable encryption at rest or use an external secret store).
- **HPA**: autoscale on CPU, memory or custom metrics; **PodDisruptionBudget** keeps capacity during node maintenance.

**Common pitfalls**
\`\`\`yaml
resources:
  requests: { cpu: 250m, memory: 256Mi }   # used for scheduling
  limits:   { memory: 512Mi }              # exceeding memory limit → OOMKilled
readinessProbe:                            # "can I receive traffic?"
  httpGet: { path: /ready, port: 3000 }
livenessProbe:                             # "am I stuck? restart me"
  httpGet: { path: /live, port: 3000 }
  initialDelaySeconds: 10
lifecycle:
  preStop: { exec: { command: ["sleep", "5"] } }   # let the LB stop sending traffic first
terminationGracePeriodSeconds: 30
\`\`\`
- No requests or limits → noisy neighbours, unpredictable scheduling; CPU limits that are too low → **throttling** and latency spikes; memory limits too low → **OOMKilled**.
- **Liveness probes that check dependencies** (DB, other services): a DB blip restarts every pod at once, a self-inflicted outage. Liveness = "this process is broken"; readiness = "do not send me traffic right now".
- **No graceful shutdown**: handle SIGTERM, stop accepting new requests, finish in-flight ones, close connections.
- \`latest\` image tags (non-reproducible deploys); running as root; secrets in env vars printed to logs.
- Stateful databases on Kubernetes without operators and expertise.`,
  },
  {
    id: 'ops-cicd',
    category: 'DevOps & Observability',
    difficulty: 1,
    question: 'What does a good CI/CD pipeline look like?',
    tldr: 'Small changes merged often to trunk, fast automated checks on every PR, one immutable artifact built once and promoted through environments, automated and progressive deployment with automatic rollback, infrastructure as code, and DORA metrics to track it.',
    answer: `**Source control practices**: **trunk-based development** with short-lived branches (hours to a couple of days), small PRs, feature flags for unfinished work, and required reviews and checks on \`main\`.

**CI (on every PR and push)**
- Install with lockfiles, build, lint, type-check, unit and integration tests in parallel, with dependency and build caching. Target **< 10 minutes**: slow pipelines lead to bigger batches and more risk.
- Security: SAST, dependency scanning (SCA), secret scanning, container image scanning; generate an SBOM.
- Build the artifact **once**: a container image tagged with the commit SHA, signed (cosign) and pushed to a registry.

**CD**
- **Build once, deploy many**: the same image is promoted dev → staging → production; only configuration differs (env vars, secrets).
- Automatic deploy to staging + smoke and E2E tests.
- Production deploy via **canary or blue-green** with automated analysis and rollback.
- Database migrations as a separate, backward-compatible step.
- **GitOps** (Argo CD, Flux): the desired state lives in git and the cluster reconciles to it, which gives an audit trail and easy rollback (\`git revert\`).
- **Infrastructure as Code** (Terraform/OpenTofu, Pulumi) with plan in the PR and apply after merge.

\`\`\`yaml
# GitHub Actions (simplified)
name: ci
on: [pull_request, push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint && npm run typecheck
      - run: npm test -- --coverage
  image:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t ghcr.io/acme/app:\${{ github.sha }} .
      - run: docker push ghcr.io/acme/app:\${{ github.sha }}
\`\`\`

**Measure with DORA metrics**
- Deployment frequency (elite: on demand, many per day).
- Lead time for changes (commit → production).
- Change failure rate.
- Time to restore service.
These four predict delivery performance far better than lines of code or story points.`,
  },

  // =====================================================================
  // PERFORMANCE
  // =====================================================================
  {
    id: 'perf-approach',
    category: 'Performance',
    difficulty: 2,
    question: 'An endpoint has a p99 latency of 3 seconds. How do you approach optimising it?',
    tldr: 'Measure before changing anything: use traces and percentiles to find where the time goes, fix the biggest bottleneck (usually DB queries, sequential remote calls or pool waits), measure again, and protect the result with load tests and alerts.',
    answer: `**1. Measure, do not guess**
- Look at the **latency distribution** (p50, p95, p99, max), not the average. Is it all requests or specific ones (certain customers, payload sizes, times of day)?
- Use **distributed tracing** to see the breakdown: DB time, downstream calls, CPU, serialisation, waiting for a connection or a lock.
- Correlate with resource metrics: CPU, GC pauses, connection pool saturation, thread pool queues.

**2. Find the bottleneck**: per Amdahl's law, optimising anything that is not the dominant cost barely helps. Typical culprits:
- **Database**: missing index, N+1 queries, huge result sets, lock waits.
- **Sequential remote calls** that could run in parallel.
- **Connection pool exhaustion**: requests wait in a queue for a connection (fast queries, slow endpoint).
- Large payloads: serialising megabytes of JSON, no pagination or compression.
- **GC pressure** from excessive allocations; synchronous CPU-heavy work (Node event loop blocking).
- Cold caches, cold starts (serverless), DNS or TLS setup without connection reuse.

**3. Fix one thing, then measure again**
\`\`\`js
// before: ~ 400 + 600 + 900 ms sequentially
const user = await getUser(id);
const orders = await getOrders(id);
const recs = await getRecommendations(id);

// after: ~ max(400, 600, 900) ms, with a timeout and a fallback for the non-critical call
const [user, orders, recs] = await Promise.all([
  getUser(id),
  getOrders(id),
  withTimeout(getRecommendations(id), 300).catch(() => []),
]);
\`\`\`

**4. If it cannot be fast enough synchronously**
- Make it **asynchronous**: accept the request (202) and process it in a job, notify via polling, webhook or WebSocket.
- Precompute or cache results; materialised views.
- Degrade gracefully: return partial data.

**5. Protect the result**: load test (k6, Gatling) the endpoint in CI or before releases, set alerts on p99, add performance budgets.

**Tail latency** matters more than it seems: if a page makes 50 backend calls, most page loads hit at least one p99-slow call. Techniques: timeouts with fallbacks, hedged requests, reducing fan-out, isolating slow tenants.`,
  },
  {
    id: 'perf-connection-pool',
    category: 'Performance',
    difficulty: 2,
    question: 'Why do we use connection pools and how do you size them?',
    tldr: 'Opening database connections is expensive, so a pool keeps a small set of reusable ones; bigger is not better because the database has limited cores and I/O, so start small (about cores × 2 + disks), keep pool × instances under max_connections, and measure.',
    answer: `**Why pool**: a new DB connection costs a TCP + TLS handshake, authentication, and in PostgreSQL a whole new backend **process** (several MB of memory). Doing that per request adds tens of milliseconds and can overwhelm the DB. A pool keeps connections open and lends them out.

**Sizing: smaller than you think**
- The database can only execute as many queries in parallel as it has CPU cores and I/O capacity. Beyond that, extra connections just add context switching, lock contention and memory usage, so **throughput drops and latency rises**.
- HikariCP's rule of thumb as a starting point: \`connections = (core_count × 2) + effective_spindle_count\`. For a 8-core DB server with SSDs that is roughly 16–20 connections **in total**, not per app instance.
- Then load-test and tune based on wait time and DB metrics.

**The fleet-wide math**: \`pool_size × number_of_app_instances ≤ max_connections\` (minus reserve for admins, migrations and replication). With autoscaling to 50 pods × 20 connections you need 1000 connections, which most Postgres setups cannot handle.
- Solution: a **server-side pooler** such as **PgBouncer** (transaction pooling mode), RDS Proxy or Supavisor. Many app connections are multiplexed onto a few real DB connections. Essential for serverless functions.

\`\`\`js
// node-postgres pool with sane settings
const pool = new Pool({
  max: 10,                        // per instance; budget across the fleet
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000, // fail fast instead of queueing forever
  statement_timeout: 5_000,       // kill runaway queries
});

// always release the client, even on error
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... short transaction, NO http calls in here ...
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
\`\`\`

**Monitor**: active vs idle connections, **wait time for a connection** (the key saturation signal), timeouts, leaked connections (never released).

**Anti-patterns**: holding a connection during remote calls or user think-time; long transactions; one huge pool shared by OLTP traffic and heavy reporting (use separate pools or a replica for reports, which is the bulkhead idea).`,
  },

  // =====================================================================
  // ALGORITHMS & LIVE CODING
  // =====================================================================
  {
    id: 'algo-lru',
    category: 'Algorithms & Live Coding',
    difficulty: 3,
    question: 'Implement an LRU cache with O(1) get and put.',
    tldr: 'Combine a hash map (key → node) with a doubly linked list ordered by recency: get moves the node to the front, put inserts at the front and evicts from the tail when over capacity. In JS a Map\'s insertion order gives a compact version.',
    answer: `**Classic solution: hash map + doubly linked list**
- The map gives O(1) access to a node by key.
- The list keeps recency order; with \`prev\`/\`next\` pointers, moving or removing a node is O(1).
- Sentinel head and tail nodes remove edge cases.

\`\`\`js
class Node {
  constructor(key, value) { this.key = key; this.value = value; this.prev = this.next = null; }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
    this.head = new Node();            // most recent after head
    this.tail = new Node();            // least recent before tail
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
  #remove(node) { node.prev.next = node.next; node.next.prev = node.prev; }
  #addFront(node) {
    node.next = this.head.next; node.prev = this.head;
    this.head.next.prev = node; this.head.next = node;
  }
  get(key) {
    const node = this.map.get(key);
    if (!node) return -1;
    this.#remove(node); this.#addFront(node);   // mark as most recently used
    return node.value;
  }
  put(key, value) {
    let node = this.map.get(key);
    if (node) { node.value = value; this.#remove(node); this.#addFront(node); return; }
    node = new Node(key, value);
    this.map.set(key, node); this.#addFront(node);
    if (this.map.size > this.capacity) {
      const lru = this.tail.prev;               // evict least recently used
      this.#remove(lru); this.map.delete(lru.key);
    }
  }
}
\`\`\`

**Compact JS version** (Map preserves insertion order; re-inserting moves a key to the end):
\`\`\`js
class LRU {
  constructor(cap) { this.cap = cap; this.m = new Map(); }
  get(k) {
    if (!this.m.has(k)) return -1;
    const v = this.m.get(k); this.m.delete(k); this.m.set(k, v); return v;
  }
  put(k, v) {
    this.m.delete(k); this.m.set(k, v);
    if (this.m.size > this.cap) this.m.delete(this.m.keys().next().value);
  }
}
\`\`\`
Mention that it works because of Map's ordering guarantee, but interviewers often want the linked-list version to see that you understand the data structures. In Java, \`LinkedHashMap\` with \`accessOrder = true\` and \`removeEldestEntry\` does it in a few lines.

**Talk about**: complexity (O(1) time per operation, O(capacity) space), thread safety (a lock around get/put, or segmenting by key hash), TTL support, and LRU vs LFU (frequency-based, better for stable popularity) vs W-TinyLFU (Caffeine).`,
    followUps: [
      { q: 'How would you make it thread-safe?', a: 'Simplest: one lock around get and put (note that get also mutates the order, so even reads need the lock). For higher throughput: shard the cache into N segments by key hash, each with its own lock, or use a library like Caffeine that buffers reads and applies reordering asynchronously.' },
      { q: 'What is the difference between LRU and LFU?', a: 'LRU evicts the item not used for the longest time; LFU evicts the item used least often. LRU adapts quickly to changing access patterns but a single scan can flush the cache; LFU keeps long-term popular items but adapts slowly. Modern caches (W-TinyLFU) combine recency and frequency.' },
    ],
  },
  {
    id: 'algo-patterns',
    category: 'Algorithms & Live Coding',
    difficulty: 2,
    question: 'Which algorithmic patterns are worth knowing for live coding, and how do you approach the interview?',
    tldr: 'A dozen patterns cover most problems: hash maps, two pointers, sliding window, binary search, BFS/DFS, heaps, intervals, prefix sums, backtracking, dynamic programming, topological sort and union-find. Process matters as much as code: clarify, brute force, optimise, test.',
    answer: `**Patterns with a typical signal**
- **Hash map / set**: "find pairs", "count", "seen before?" → O(n) instead of O(n²) (two sum, anagram groups).
- **Two pointers**: sorted arrays, palindromes, removing duplicates in place, merging.
- **Sliding window**: "longest/shortest substring or subarray with property X".
- **Binary search**: sorted data, or "minimum value that satisfies a monotonic condition" (binary search on the answer).
- **BFS / DFS**: graphs, grids ("number of islands"), trees. **BFS** gives shortest paths in unweighted graphs.
- **Heap / priority queue**: top K, merge K sorted lists, streaming median, scheduling (Dijkstra).
- **Intervals**: sort by start, then merge or sweep (meeting rooms).
- **Prefix sums**: range sums, "subarray sums to K" (with a hash map).
- **Backtracking**: permutations, combinations, subsets, N-queens.
- **Dynamic programming**: overlapping subproblems (climbing stairs, coin change, knapsack, longest common subsequence, edit distance).
- **Topological sort**: dependency ordering (course schedule, build systems).
- **Union-Find**: connected components, cycle detection in undirected graphs.

**Example: sliding window (longest substring without repeating characters)**
\`\`\`js
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map();
  let best = 0, left = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) left = lastSeen.get(ch) + 1; // shrink window
    lastSeen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;   // O(n) time, O(alphabet) space
}
\`\`\`

**Example: BFS on a grid (number of islands)**
\`\`\`js
function numIslands(grid) {
  const R = grid.length, C = grid[0].length; let count = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (grid[r][c] !== '1') continue;
    count++; grid[r][c] = '0';
    const queue = [[r, c]];
    while (queue.length) {
      const [y, x] = queue.shift();
      for (const [dy, dx] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < R && nx >= 0 && nx < C && grid[ny][nx] === '1') {
          grid[ny][nx] = '0'; queue.push([ny, nx]);
        }
      }
    }
  }
  return count;
}
\`\`\`

**Interview process (as important as the code)**
1. Restate the problem; clarify inputs, constraints, edge cases (empty input, duplicates, negative numbers, huge n).
2. Work through a small example by hand.
3. State a **brute-force** solution and its complexity.
4. Optimise, naming the pattern and the trade-off.
5. Write clean code with good names and talk while you do it.
6. **Test** it on your example and on edge cases, and state the final time and space complexity.`,
  },
  {
    id: 'algo-top-k',
    category: 'Algorithms & Live Coding',
    difficulty: 2,
    question: 'How do you find the K most frequent elements? What about a huge stream across many machines?',
    tldr: 'In memory, count with a hash map and keep a min-heap of size K (O(n log K)) or bucket by frequency (O(n)); at scale, use approximate sketches (Count-Min + heap, Space-Saving) or a distributed count-then-merge, usually over time windows.',
    answer: `**In memory**
1. Count frequencies with a hash map: O(n).
2. Pick the top K:
- Sort all entries by count: O(m log m) where m = distinct items.
- **Min-heap of size K**: O(m log K). Better when K ≪ m.
- **Bucket sort** by frequency (index = count): O(n).

\`\`\`js
function topKFrequent(nums, k) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) || 0) + 1);

  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [num, count] of freq) buckets[count].push(num);

  const result = [];
  for (let c = buckets.length - 1; c > 0 && result.length < k; c--) {
    for (const num of buckets[c]) {
      result.push(num);
      if (result.length === k) break;
    }
  }
  return result;   // O(n) time, O(n) space
}
\`\`\`
(In Python: \`heapq.nlargest(k, counter.items(), key=lambda x: x[1])\`; in Java a \`PriorityQueue\` with a comparator.)

**Huge streams / "trending hashtags" at scale**
- Exact counts for billions of distinct keys do not fit in memory, so use **approximate** algorithms:
  - **Count-Min Sketch**: a small 2D array of counters with several hash functions; overestimates but never underestimates; constant memory. Combine with a min-heap of candidate heavy hitters.
  - **Space-Saving / Misra-Gries**: track at most K' counters, with guaranteed error bounds for heavy hitters.
- **Distributed**: partition the stream by key (each node counts its keys exactly), then merge each node's top candidates. Careful: if data is **not** partitioned by key, local top-K lists do not produce the exact global top-K; you need to send more candidates (or exact counts for candidates) to the merger.
- **Time windows**: "top K in the last hour" uses tumbling or sliding windows in a stream processor (Kafka Streams, Flink, Spark Structured Streaming), possibly with decayed counts for "trending".
- Pre-aggregate at the edge (per server, per minute) to reduce volume, then store results in Redis sorted sets (\`ZINCRBY\`, \`ZREVRANGE 0 K-1\`) for serving.`,
  },

  // =====================================================================
  // LEADERSHIP & BEHAVIORAL (SENIOR)
  // =====================================================================
  {
    id: 'lead-what-senior',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 1,
    question: 'In your view, what distinguishes a senior engineer from a mid-level one?',
    tldr: 'Scope and ownership, not years or framework knowledge: a senior turns ambiguous problems into delivered outcomes, makes sound trade-offs, anticipates risks, and makes the whole team better.',
    answer: `A strong answer gives a clear definition **and backs each point with a short example from your own experience**.

**What seniors do differently**
- **Own outcomes, not tickets**: understand the business goal behind a task, question requirements that do not serve it, and follow through until the result is in production and working (monitoring, rollout, cleanup).
- **Handle ambiguity**: get a problem ("checkout conversion dropped on mobile"), not a spec; break it down, clarify, and plan the work for themselves and others.
- **Make trade-offs consciously**: speed vs quality, build vs buy, consistency vs availability, and explain them to non-engineers. They know when **not** to build something, and when good enough is good enough.
- **Think in systems and over time**: operability, failure modes, security, cost, maintainability, migration paths, the people who will maintain the code later.
- **Multiply the team**: mentoring, thoughtful code reviews, documentation, improving processes and tooling, unblocking others. Their impact is measured by the team's output, not just their own commits.
- **Communicate proactively**: raise risks early, give realistic estimates with uncertainty, write clear design docs, disagree constructively, and **disagree and commit**.
- **Know their limits**: say "I don't know, I'll find out", ask for help early, and learn continuously.

**Example framing**
*"For me it is mostly about scope of impact. At my current company I was asked to 'add multi-currency support'. Instead of starting with code, I mapped where amounts flow through the system, found three services that assumed EUR, wrote a short design doc with two options and their risks, and split the work so two mid-level engineers could implement parts with me reviewing. We shipped it behind a flag per market. That end-to-end ownership and making others effective is what I see as senior."*`,
  },
  {
    id: 'lead-disagree',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 2,
    question: 'Tell me about a time you disagreed with a technical decision (by a lead, architect or the team).',
    tldr: 'Use STAR and show that you first understood the other side, argued with data rather than opinion, kept it respectful and private, accepted the final decision (disagree and commit), and learned something either way.',
    answer: `**What the interviewer is checking**: maturity, influence without authority, ego management, and whether you can move forward after losing an argument.

**Structure (STAR)**
- **Situation**: the decision, who made it, what was at stake.
- **Task**: your role and why you felt you needed to speak up.
- **Action** (the core):
  1. **Understand first**: ask about the goals and constraints behind the decision. Often there is context you were missing.
  2. **Make it about data**: benchmarks, a spike or prototype, cost estimates, incident history, risks written down.
  3. **Right channel**: a 1:1 conversation or a design review, not a public fight in Slack or PR comments.
  4. **Offer options**, including compromises (time-boxed trial, reversible first step, success metrics with a checkpoint).
  5. **Disagree and commit**: once decided, support it fully, including in front of others.
- **Result**: the outcome, and what you learned (about the tech, the people, or how to influence).

**Example skeleton**
*"Our architect proposed moving all inter-service communication to Kafka events. I was worried about debugging complexity and eventual consistency in the checkout flow, where we needed immediate confirmation (S/T). I asked for a 30-minute session to understand the motivation, which was decoupling and resilience during peak sales. I then built a small spike comparing a synchronous call with an outbox + event flow for checkout and measured the latency and failure behaviour (A). We agreed on a hybrid: events for notifications and analytics, synchronous calls with retries for payment confirmation. We documented it in an ADR. Six months later the event-driven parts handled Black Friday well, and I learned that his concern about coupling was more justified than I first thought (R)."*

**Avoid**: stories where you were simply right and everyone else was wrong, where you escalated over someone's head first, or where you complied silently and later said "I told you so".`,
  },
  {
    id: 'lead-mentoring',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 1,
    question: 'How do you mentor junior and mid-level engineers?',
    tldr: 'Tailor it to the person: understand their goals, give them stretch work with a safety net, coach with questions instead of answers, give specific and timely feedback, and gradually hand over ownership.',
    answer: `**Principles**
- **Start with the person**: what are their goals (deeper tech, broader product skills, leadership)? Where are they now? Agree on a few concrete growth areas.
- **Stretch with a safety net**: tasks slightly beyond their current level, with clear expectations, check-ins and the freedom to make (recoverable) mistakes.
- **Coach, don't just tell**: "How would you approach this?", "What could go wrong here?", "Where would you look first?". Give the answer when they are truly stuck or time matters, and explain the reasoning.
- **Make the implicit explicit**: explain *why* in code reviews, share how you debug, how you estimate, how you read an unfamiliar codebase. Link to docs and good examples.
- **Psychological safety**: questions are welcome, "I don't know" is fine, mistakes are learning opportunities (blameless).

**Concrete practices**
- **Pair programming** on hard problems, alternating driver and navigator.
- **Review-based teaching**: comments that explain trade-offs, not just "change this"; occasionally let them review your PRs.
- Regular **1:1s** (e.g. every two weeks): progress, blockers, feedback both ways.
- **Feedback** that is specific and timely, using **SBI** (Situation, Behaviour, Impact): *"In yesterday's design review (S), you walked through the failure modes before anyone asked (B), which saved us a second meeting and convinced the PM (I)."*
- Give **visibility**: let them present their work at demos or write the design doc.
- **Gradually transfer ownership**: from a well-defined task, to a feature, to a component they are the go-to person for.

**Measuring success**: they need you less over time, take on larger scope independently, and start mentoring others. Mention a real example of someone you helped grow, what you did, and the outcome.`,
  },
  {
    id: 'lead-estimation',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 2,
    question: 'How do you estimate large pieces of work, and what do you do when a project is slipping?',
    tldr: 'Break the work down, de-risk unknowns with spikes, give ranges with confidence levels that include the often-forgotten work, re-forecast as you learn, and when slipping, communicate early with concrete options: cut scope, move the date or change the approach.',
    answer: `**Estimating**
- **Decompose** into pieces of a few days at most; unclear pieces are a signal of unknowns.
- **Identify the biggest risks and unknowns** (a new technology, third-party integration, data migration, unclear requirements) and run time-boxed **spikes** before committing.
- **Include the invisible work**: tests, code review, deployment, migrations, monitoring, documentation, security review, coordination with other teams, holidays and on-call.
- Give **ranges with confidence**, not single numbers: *"4–6 weeks, about 70% confidence; the Stripe integration is the main risk."* A 3-point estimate (optimistic / likely / pessimistic) helps.
- Use **reference classes**: how long did similar work actually take last time?
- Estimate **as a team** to surface different perspectives.
- Separate **estimates** (our best guess) from **commitments** (what we promise, with a buffer) and from **targets** (what the business wishes).

**Tracking**: deliver in thin vertical slices so progress is real and visible (not "80% done" for weeks); re-forecast regularly as you learn; watch scope creep.

**When it slips**
1. **Detect early**: burn-up charts, slipped milestones, recurring "almost done".
2. **Communicate early**, as soon as you know, not on the deadline. Bring facts, the cause and options:
   - **Reduce scope**: what is the MVP that still delivers the core value? Move the rest to phase two.
   - **Move the date**, with a realistic new forecast.
   - **Change the approach**: buy instead of build, simplify the design, temporary manual workarounds.
   - **Add people** only carefully. **Brooks's law**: adding people to a late project often makes it later, because of onboarding and communication overhead, unless the work is easily parallelised and the new people already know the code.
3. **Let stakeholders decide** the trade-off with full information.
4. **Retrospective**: why did we misjudge? Improve the next estimate.

**Do not**: silently work overtime to cover a bad estimate, quietly cut quality (tests, security), or keep reporting green until the last day.`,
  },
  {
    id: 'lead-production-failure',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 2,
    question: 'Tell me about the biggest mistake you made in production.',
    tldr: 'Pick a real mistake with real impact, own it without excuses, explain how you responded, what the root cause was, and above all what you changed in the system so it cannot happen again.',
    answer: `**What the interviewer is checking**: honesty, ownership, composure under pressure, and whether you learn **systemically** rather than just "being more careful next time".

**Structure**
1. **What happened and the impact**: be concrete and do not minimise ("checkout was failing for 12% of users for 40 minutes, roughly €30k in lost orders").
2. **Your response**: how it was detected, how quickly you escalated, how you mitigated (rollback, flag), how you communicated.
3. **Root cause**: the technical cause **and** the process gap that let it through (why did tests, review or staging not catch it?).
4. **Systemic fixes**: what changed so nobody can make the same mistake: tests, alerts, guardrails, automation, runbooks, review checklists.
5. **What you personally learned.**

**Example**
*"I ran a data-migration script that was meant to normalise phone numbers. I tested it on staging, but staging had clean data; production had legacy records in a format the script did not handle, and it set about 40k numbers to null. SMS notifications started failing (impact). We noticed via an alert on SMS delivery errors 20 minutes later; I stopped the job, told the incident channel, and we restored the column from the point-in-time backup into a side table and back-filled it within two hours (response). Root causes: the script had no dry-run mode, it was not idempotent, and our staging data did not represent production (root cause). Afterwards I added a migration framework rule: every data migration needs a dry-run report, runs in batches with a checkpoint, writes to a new column first, and is tested on an anonymised production snapshot. We have not had a similar incident since (systemic fix)."*

**Avoid**: "I never made a serious mistake", trivial examples, blaming others, or a story with no lasting improvement.`,
  },
  {
    id: 'lead-product',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 2,
    question: 'A product manager wants a feature "yesterday", but you can see the quick way will damage the architecture. What do you do?',
    tldr: 'Understand the real business need and deadline, then offer concrete options with their costs (a deliberate shortcut with a recorded payback plan, a smaller scope done right, or the full solution later), framed in business terms, and decide together.',
    answer: `**1. Understand the need behind the request**
- What problem are we solving and for whom? What happens if it ships two weeks later? Is the deadline real (contract, regulation, event, competitor launch) or arbitrary?
- Often the urgency is about one specific customer or demo, which allows a narrower solution.

**2. Present options, not just "no"**
- **Option A: quick path with deliberate debt**: what we cut, the concrete risks (incidents, slower future features, security), and a **scheduled** payback ticket agreed **now** (e.g. "two days in the next sprint to move this into the pricing module").
- **Option B: reduced scope done properly**: an MVP that delivers the core value by the deadline on a sound foundation (e.g. only one market, manual steps in the back office, feature flag for a pilot customer).
- **Option C: the full solution**, with a realistic date.

**3. Speak the language of the business**
- Not "this is ugly" or "it violates clean architecture", but: *"If we hard-code this, every new pricing rule will take a week instead of a day, and we had two pricing incidents last quarter in exactly this code."*
- Quantify where possible: time, money, risk, customer impact.

**4. Decide together and document it**
- The PM owns the product priorities; you own the technical risk assessment. Make the trade-off **explicit and shared**, record it (ticket, ADR, short note), and then deliver whichever option is chosen professionally.
- Follow up on the payback plan; if shortcuts never get paid back, raise that pattern with the PM and engineering manager.

**Example close**: *"In my last team we chose option B: we shipped invoicing for Polish customers only, behind a flag, on the proper module structure, in the original deadline. The other markets followed three weeks later without rework."*

**What the interviewer wants to see**: you act as a **partner** to the business, neither a blocker hiding behind "best practices" nor a yes-person who silently accumulates risk.`,
  },
  {
    id: 'lead-legacy',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 2,
    question: 'You inherit a large legacy system without tests or documentation. Where do you start?',
    tldr: 'Understand before changing (people, traffic, critical flows, hotspots), build a safety net (monitoring, characterisation tests, easy rollback), then improve incrementally where change is frequent, documenting as you go, and avoid a big-bang rewrite.',
    answer: `**1. Understand before changing**
- Talk to the people who know it: original developers, support, operations, product owners. What breaks? What do customers complain about? What are the "do not touch" areas?
- Map the system: entry points, main flows, data stores, integrations, deployments. Draw a C4 context and container diagram.
- Use data: logs and metrics for which endpoints and jobs actually matter, **git history** for hotspots (often changed and buggy files), error trackers.

**2. Build a safety net**
- **Observability first**: error tracking, key business metrics (orders per minute), alerts. If you break something, you need to know immediately.
- Reliable, repeatable **build and deploy** with fast rollback.
- **Characterisation (golden master) tests**: capture what the system *currently* does, even if it is wrong, so refactoring does not change behaviour unintentionally.
\`\`\`js
// golden master: record outputs for many inputs once, then assert they never change during refactoring
const cases = loadRecordedRequests('fixtures/invoices/*.json');
test.each(cases)('invoice calculation unchanged for %s', (name, input) => {
  expect(calculateInvoice(input)).toMatchSnapshot();
});
\`\`\`
- Start with high-level tests around the most critical flows (API- or UI-level), since unit tests are often impossible before refactoring.

**3. Improve incrementally**
- Change code mainly **where you need to work anyway** (features, bugs); improve the hotspots first.
- Techniques from *Working Effectively with Legacy Code* (Michael Feathers): find **seams**, break dependencies to get code under test, sprout method / sprout class (write new logic in new, tested code and call it from the old), wrap legacy APIs.
- For larger changes: **Strangler Fig** (route functionality piece by piece to new components), **branch by abstraction** (introduce an interface, switch implementations behind a flag).
- Upgrade dependencies and runtimes step by step; remove dead code (verified via metrics and logs).

**4. Document as you learn**: README for setup, runbooks, ADRs for decisions, diagrams kept next to the code.

**5. Avoid the big-bang rewrite**: it usually takes much longer than planned, delivers no value until the end, and loses years of undocumented business rules and bug fixes embedded in the old code. Rewrite only isolated pieces, with a clear migration path and parallel running or comparison of results.`,
  },
  {
    id: 'lead-questions-to-ask',
    category: 'Leadership & Behavioral (Senior)',
    difficulty: 1,
    question: 'What questions do you ask the company at the end of an interview?',
    tldr: 'Ask questions that show seniority and help you evaluate the role: how they build and ship, how decisions are made, how they handle debt and incidents, what success looks like for this role, and why it is open.',
    answer: `The end of the interview is your chance to **interview them**, and good questions are themselves a seniority signal. Prepare 5–8 and pick 2–3 depending on the interviewer (engineer, manager, executive).

**Engineering practices**
- "Walk me through how an idea gets to production. How often do you deploy, and how long does it take?"
- "How do you test? What does your CI pipeline look like and how long does it take?"
- "How do you handle on-call and incidents? When was the last big incident, and what changed afterwards?"

**Decision-making and culture**
- "How are architectural decisions made? Who is involved, and are they written down?"
- "Tell me about a recent technical disagreement in the team and how it was resolved."
- "How much time realistically goes to technical debt and platform work versus features?"

**The role and growth**
- "What would make someone in this role successful after 3, 6 and 12 months?"
- "What is the biggest technical challenge the team will face this year?"
- "What does the career path look like beyond senior (staff/principal, engineering manager)?"
- "Why is this position open?" (growth, or someone left, and why?)

**Product and business**
- "How do engineers interact with product and users? Do engineers talk to customers?"
- "How does the team measure the impact of what it ships?"

**For the hiring manager specifically**
- "How do you give feedback and support growth on your team?"
- "What do you wish you could change about how the team works today?"

**Avoid**: questions answered on their homepage, asking only about salary and perks in early technical rounds (save these for HR or the offer stage), and having no questions at all, which reads as low interest.`,
  },
]);
