/*
  .NET TRACK: AZURE / DOCKER / DEVOPS, SECURITY & ENTRA ID, TESTING
  Format: see the comment at the top of questions.js
*/
addQuestions('dotnet', [
  // =====================================================================
  // AZURE, DOCKER, DEVOPS
  // =====================================================================
  {
    id: 'az-functions-vs-appservice',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'Azure Functions or App Service (or Container Apps / AKS): how do you decide?',
    tldr: 'App Service for always-on web apps and APIs; Functions for event-driven, short, bursty work (queues, blobs, timers) where per-execution scaling and pay-per-use matter; Container Apps for containerised microservices without managing Kubernetes; AKS only when you need full Kubernetes control.',
    answer: `| | App Service | Azure Functions | Container Apps | AKS |
|---|---|---|---|---|
| Unit | web app / API | function triggered by an event | container(s) | pods on a cluster you run |
| Scaling | manual / autoscale rules, always ≥ 1 instance | automatic per event load, to zero (Consumption/Flex) | KEDA-based, to zero, HTTP/queue rules | HPA/KEDA, full control |
| Best for | ASP.NET Core APIs, websites, long-lived processes | queue/blob/Event Grid/timer processing, glue code, webhooks | microservices, background workers, Dapr | complex platforms, many teams, special networking |
| Ops effort | low | very low | low–medium | high |

**Decision questions**
- Is it **request/response, always on**, with steady traffic? → App Service.
- Is it **triggered by events**, short, spiky, maybe idle most of the time? → Functions (watch execution time limits and cold start).
- Do we already ship **containers**, need several services, sidecars, scale to zero? → Container Apps.
- Need custom operators, service mesh, node-level control and have a platform team? → AKS.

**Costs**: Functions Consumption/Flex is cheapest for sporadic load; App Service plan is paid per instance whether busy or not; several apps can share one plan.

**Your example**: [what ran where in your project and why — e.g. API on App Service, Event Grid-triggered Functions for file processing].`,
  },
  {
    id: 'az-functions-cold-start',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'What is a cold start in Azure Functions and how do you reduce it? Which hosting plans exist?',
    tldr: 'Cold start is the delay when a new instance must be allocated and the app loaded after idling or when scaling out; reduce it with Premium (always-ready/pre-warmed instances) or Flex Consumption always-ready, smaller startup work, isolated worker with ReadyToRun, and keeping dependencies light.',
    answer: `**Plans**
- **Consumption**: pay per execution, scales to zero → cold starts, execution time limit (5 min default, 10 max), limited networking. Legacy Linux Consumption is being retired in favour of Flex.
- **Flex Consumption**: pay per use, fast scaling, **VNet integration**, configurable instance memory, optional **always-ready** instances.
- **Premium (Elastic Premium)**: pre-warmed instances (no cold start), VNet, longer executions, minimum cost per instance.
- **Dedicated (App Service plan)**: runs on your App Service instances, predictable cost, Always On.

**Reducing cold start**
- Always-ready / pre-warmed instances (Premium, Flex).
- Lighter startup: fewer heavy dependencies, lazy initialisation, avoid big DI graphs and synchronous I/O at startup.
- **Isolated worker model** (.NET 8+; the in-process model is end-of-support) with ReadyToRun / trimmed publish.
- Keep the function app focused (not 50 functions with different dependencies).
- For a user-facing latency-critical API, use App Service / Container Apps with min replicas ≥ 1 instead.

**Triggers & bindings**: HTTP, Timer, Queue/Service Bus, Blob, Event Grid, Event Hub, Cosmos DB change feed. Bindings (input/output) declaratively read/write storage without client code.

**Durable Functions**: stateful orchestrations in code (function chaining, fan-out/fan-in, human interaction with timeouts, sagas). State is checkpointed to storage; orchestrator code must be **deterministic** (no \`DateTime.Now\`, no direct I/O — use activities).`,
  },
  {
    id: 'az-event-grid-project',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'How does Event Grid work and what did you use it for in your project?',
    tldr: 'Event sources (e.g. Blob Storage, custom topics) publish small events to a topic; subscriptions with filters push them to handlers (Functions, webhooks, Service Bus, Storage Queues) with retries and dead-lettering, at-least-once.',
    answer: `**Concepts**
- **Event source / topic**: system topics for Azure services (Blob Created, Resource Group changes, Key Vault events) or **custom topics** for your own app events.
- **Event subscription**: filter (event type, subject prefix/suffix e.g. \`/blobServices/default/containers/uploads/\` + \`.pdf\`, advanced filters) and an **endpoint**: Azure Function, webhook, Service Bus queue/topic, Storage Queue, Event Hub.
- **Push delivery** with retries (exponential backoff, up to 24 h by default), **dead-letter** to a blob container.
- Schemas: Event Grid schema or **CloudEvents** 1.0.
- Webhook endpoints must pass a **validation handshake**.

\`\`\`csharp
[Function("OnBlobUploaded")]
public async Task Run([EventGridTrigger] EventGridEvent evt, CancellationToken ct)
{
    var data = evt.Data.ToObjectFromJson<StorageBlobCreatedEventData>();
    _logger.LogInformation("New blob {Url}", data.Url);
    await _processor.ProcessAsync(new Uri(data.Url), ct);   // must be idempotent: at-least-once
}
\`\`\`

**Things to mention**
- Handlers must be **idempotent** (duplicates possible), events are small (notification, not the payload — fetch the blob yourself).
- No ordering guarantee.
- For work that needs buffering, controlled concurrency or long processing, route Event Grid → **Service Bus queue** → worker.

**Your story**: [e.g. file uploaded to Blob → Event Grid → Function that parses/validates/sends notifications; what problem it solved compared with polling; any issues like duplicates or retries].`,
  },
  {
    id: 'az-secrets-managed-identity',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'How do you store application secrets in Azure? What is Managed Identity and why is it better than a connection string?',
    tldr: 'Secrets go to Key Vault (referenced from App Service settings or loaded via the configuration provider), never to code or the repo; Managed Identity gives the app an Entra ID identity so it gets tokens for SQL, Storage, Key Vault and Service Bus without any secret to store, rotate or leak.',
    answer: `**Where secrets go**
- **Key Vault** for secrets, keys and certificates. Access with RBAC, audit logs, soft delete, rotation.
- App Service / Functions: **Key Vault references** in app settings (\`@Microsoft.KeyVault(SecretUri=...)\`) or the config provider:
\`\`\`csharp
builder.Configuration.AddAzureKeyVault(new Uri(kvUri), new DefaultAzureCredential());
\`\`\`
- Local development: **User Secrets** (\`dotnet user-secrets\`), never \`appsettings.json\` in git. Pipelines: variable groups linked to Key Vault, secret variables.

**Managed Identity**
- An identity for the Azure resource itself, managed by Entra ID: **system-assigned** (lifecycle tied to the resource) or **user-assigned** (shared, created separately).
- The app asks the local identity endpoint for a token; no credentials in config.
\`\`\`csharp
var blobs = new BlobServiceClient(new Uri("https://acct.blob.core.windows.net"), new DefaultAzureCredential());
// SQL: "Server=...;Database=...;Authentication=Active Directory Default"
\`\`\`
- Grant access with **RBAC** (e.g. *Storage Blob Data Contributor*, *Key Vault Secrets User*), least privilege, scoped to the resource.

**Why better than a connection string with a key**
- Nothing to leak (repo, logs, screenshots), nothing to **rotate**, nothing that works from a laptop outside Azure.
- Fine-grained, auditable permissions instead of an all-powerful account key.
- You can disable shared-key / SQL auth entirely.

\`DefaultAzureCredential\` tries environment, workload identity, managed identity, Visual Studio / Azure CLI login → the same code works locally and in Azure.`,
  },
  {
    id: 'az-app-insights-slow',
    category: 'Azure & DevOps',
    difficulty: 3,
    question: 'The production app is slowing down. How do you use Application Insights to find the cause?',
    tldr: 'Start from the Performance blade (which operations got slower, p95/p99), drill into sample end-to-end transactions to see where the time goes (SQL, HTTP dependencies, own code), correlate with deployments, failures and resource metrics, and confirm with KQL queries — then set alerts so you hear about it first next time.',
    answer: `**Step by step**
1. **Scope it**: Performance blade → which operations, since when, all users or some? Compare to the time of the last deployment (release annotations).
2. **End-to-end transaction** for slow samples: the timeline shows the request and its **dependencies** (SQL, HTTP, Service Bus, Redis). Is the time in a dependency or in our code?
3. **Dependencies blade**: a SQL query that got slower, an external API with timeouts, retries piling up.
4. **Failures**: exceptions and failed dependencies often come with slowness (timeouts, retries).
5. **Resource side**: CPU, memory, thread count, GC, SNAT ports on the App Service / SQL DTU / vCore usage. **Profiler** and **Snapshot Debugger** for hot paths in code.
6. **KQL** to confirm:
\`\`\`kusto
requests
| where timestamp > ago(24h)
| summarize p95 = percentile(duration, 95), count() by name, bin(timestamp, 15m)
| order by p95 desc

dependencies
| where timestamp > ago(1h) and type == "SQL"
| summarize avg(duration), count() by target, name
| top 10 by avg_duration
\`\`\`
7. Fix (query/index, caching, timeouts, scale out), then verify on the same charts.

**Observability foundations**
- **Distributed tracing**: one operation id across services (W3C trace context) → application map.
- **OpenTelemetry** with the Azure Monitor exporter is the current recommended way for .NET (\`UseAzureMonitor()\`); structured logs with scopes and correlation ids.
- **Alerts** on p95 latency, failure rate, dependency failures, availability tests; dashboards; sampling to control cost.

The feedback said "operations & observability" is an area to grow — this answer is your chance to show you closed that gap.`,
  },
  {
    id: 'az-cicd-pipeline',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'Describe your CI/CD pipeline from commit to production.',
    tldr: 'PR with build, tests and analysis as a gate; merge to main builds one versioned artifact (or container image); the same artifact is deployed through environments (dev → test → prod) with approvals, database migrations as a separate step, slot swap and smoke tests, and a fast rollback path.',
    answer: `**Typical Azure DevOps YAML flow**
1. **Pull request**: branch policy requires a build: \`dotnet restore/build\`, **unit + integration tests**, code coverage, static analysis (analyzers, SonarCloud), dependency/secret scanning, at least one reviewer.
2. **CI on main**: build once → publish artifact / push Docker image tagged with the version or commit SHA.
3. **CD stages**: Dev → Test/UAT → Prod, each an **environment** with approvals and checks.
   - Infrastructure as Code (Bicep/Terraform) applied first.
   - **DB migrations** step (idempotent script / bundle).
   - Deploy to a **staging slot**, run smoke tests, **swap** to production.
4. **After deploy**: health checks, App Insights alerts, release annotation; rollback = swap back / redeploy the previous artifact.

\`\`\`yaml
trigger: [ main ]
stages:
- stage: Build
  jobs:
  - job: build
    pool: { vmImage: ubuntu-latest }
    steps:
    - task: UseDotNet@2
      inputs: { version: '8.x' }
    - script: dotnet test --configuration Release --collect:"XPlat Code Coverage"
    - script: dotnet publish src/Api -c Release -o $(Build.ArtifactStagingDirectory)
    - publish: $(Build.ArtifactStagingDirectory)
      artifact: api
- stage: Prod
  dependsOn: Build
  jobs:
  - deployment: deploy
    environment: production            # approvals & checks configured on the environment
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureWebApp@1
            inputs: { azureSubscription: 'prod-sc', appName: 'my-api', deployToSlotOrASE: true, slotName: staging, package: '$(Pipeline.Workspace)/api' }
\`\`\`

**Principles**: build once, deploy many; config per environment from Key Vault/app settings; no manual steps; workload identity federation for service connections (no secrets).

**Prepare**: describe *your* pipeline honestly + one improvement you would make (e.g. integration tests with Testcontainers, automated smoke tests, IaC).`,
  },
  {
    id: 'az-zero-downtime-deploy',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'How do you deploy a new version without downtime?',
    tldr: 'Deployment slots with swap (warm-up first), rolling updates behind a load balancer or blue-green/canary, combined with backward-compatible database migrations, health checks and feature flags so you can roll back quickly.',
    answer: `**App Service deployment slots**
- Deploy to the **staging** slot → it warms up (\`applicationInitialization\`, health check path) → **swap** with production. The swap only redirects traffic, so users see no restart.
- Rollback = swap again (the old version is still in staging).
- Slot-specific ("sticky") settings for things that must not move with the code.
- **Auto swap** or **swap with preview** for validation.

**Other strategies**
- **Rolling**: replace instances one by one (Kubernetes, Container Apps revisions, VM scale sets).
- **Blue-green**: two full environments, switch the router (Front Door / Traffic Manager / slot).
- **Canary**: send 5–10% of traffic to the new version (Container Apps traffic split, App Service "testing in production" percentage), watch metrics, then go to 100%.
- **Feature flags** (Azure App Configuration): deploy code dark, enable for a subset of users, kill switch.

**What actually breaks zero-downtime**
- **Database changes** that the old version cannot handle → expand/contract migrations.
- Breaking API contracts → version the API, keep old fields.
- In-memory session / state → make the app stateless (distributed cache, cookies/tokens).
- Long-running requests/messages → graceful shutdown (\`IHostApplicationLifetime\`, handle \`CancellationToken\` on stop).`,
  },
  {
    id: 'docker-image-container-multistage',
    category: 'Azure & DevOps',
    difficulty: 1,
    question: 'What is the difference between a Docker image and a container? Why use a multi-stage build?',
    tldr: 'An image is an immutable, layered template; a container is a running instance of an image with its own writable layer. Multi-stage builds compile with the SDK image and copy only the published output into a small runtime image — smaller, faster and safer.',
    answer: `**Image vs container**
- **Image**: read-only layers (each Dockerfile instruction = a layer), versioned with tags, stored in a registry (ACR).
- **Container**: a process running from an image, isolated with namespaces/cgroups, with a thin writable layer that disappears when the container is removed (persist data in volumes / external storage).
- Like class vs object.

**Multi-stage Dockerfile for ASP.NET Core**
\`\`\`dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.sln .
COPY src/Api/Api.csproj src/Api/
RUN dotnet restore                       # cached layer while csproj files don't change
COPY . .
RUN dotnet publish src/Api -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
USER app                                 # non-root user (built into .NET 8 images)
EXPOSE 8080
ENTRYPOINT ["dotnet", "Api.dll"]
\`\`\`
- The **SDK** (~800 MB, compilers) never ships; the runtime image is a few hundred MB or less (chiseled/Alpine images even smaller).
- Fewer packages = smaller attack surface, faster pulls and startup.

**Layer caching**: copy the project files and restore **before** copying the source, so code changes don't invalidate the restore layer. Add a \`.dockerignore\` (bin, obj, .git).

**docker-compose**: run the API + SQL Server + Redis locally with one command; also handy for integration tests (though Testcontainers is nicer in code).

**.NET 8+**: you can even build images without a Dockerfile: \`dotnet publish /t:PublishContainer\`.`,
  },
  {
    id: 'k8s-basic-objects',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'Explain the basic Kubernetes objects.',
    tldr: 'Pod (one or more containers scheduled together), Deployment (desired number of identical pods, rolling updates), Service (stable virtual IP/DNS in front of pods), Ingress (HTTP routing from outside), ConfigMap and Secret (configuration), plus probes, resources and HPA for scaling.',
    answer: `- **Pod**: the smallest unit; one (or a few tightly coupled) containers sharing network and storage. Ephemeral — gets a new IP when recreated.
- **ReplicaSet / Deployment**: declares "3 replicas of image v1.2"; the controller keeps that state, does **rolling updates** and rollbacks (\`kubectl rollout undo\`).
- **Service**: stable name/IP and load balancing to pods selected by labels. Types: \`ClusterIP\` (internal), \`NodePort\`, \`LoadBalancer\`.
- **Ingress** (+ ingress controller, e.g. NGINX, Application Gateway): HTTP(S) routing by host/path, TLS termination.
- **ConfigMap**: non-secret config as env vars or files. **Secret**: base64-encoded (not encrypted by default!) → better: Key Vault via the CSI driver / workload identity.
- **Namespace**: logical isolation of teams/environments, with quotas and RBAC.
- **Probes**: \`liveness\` (restart when stuck), \`readiness\` (only send traffic when ready), \`startup\`. Map them to ASP.NET Core **health checks**.
- **Resources**: requests (scheduling) and limits (CPU throttling / OOMKill for memory).
- **HPA** (Horizontal Pod Autoscaler) scales on CPU/memory; **KEDA** on queue length and events.
- StatefulSet (stable identity, for databases), DaemonSet (one per node), Job/CronJob.

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: api }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
      - name: api
        image: myacr.azurecr.io/api:1.4.2
        ports: [ { containerPort: 8080 } ]
        readinessProbe: { httpGet: { path: /health/ready, port: 8080 } }
        resources: { requests: { cpu: 100m, memory: 256Mi }, limits: { memory: 512Mi } }
\`\`\`

Honest note if relevant: "I've used it at the level of X; in production we used App Service / Container Apps, which hide most of this".`,
  },
  {
    id: 'az-blob-costs',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'How did you reduce Blob Storage costs? How do you monitor costs in Azure?',
    tldr: 'Use access tiers (Hot, Cool, Cold, Archive) with lifecycle management rules that move or delete blobs by age, pick the right redundancy, and avoid unnecessary transactions; monitor with Cost Management budgets, alerts, tags and cost analysis per resource group.',
    answer: `**Blob access tiers**
- **Hot**: frequent access; highest storage price, cheapest reads.
- **Cool** (min 30 days), **Cold** (min 90 days): cheaper storage, more expensive access, early-deletion fee.
- **Archive** (min 180 days): cheapest storage, **offline** — rehydration takes hours. For compliance copies and backups.

**Lifecycle management policy** (no code):
\`\`\`json
{ "rules": [ { "name": "age-out", "type": "Lifecycle", "definition": {
  "filters": { "blobTypes": [ "blockBlob" ], "prefixMatch": [ "reports/" ] },
  "actions": { "baseBlob": {
      "tierToCool":    { "daysAfterModificationGreaterThan": 30 },
      "tierToArchive": { "daysAfterModificationGreaterThan": 180 },
      "delete":        { "daysAfterModificationGreaterThan": 2555 } } } } } ] }
\`\`\`

**Other cost levers**
- Redundancy: LRS/ZRS vs GRS (geo-replication doubles the storage cost) — choose per data criticality.
- Delete orphaned files, old snapshots and versions; compress; avoid millions of tiny transactions (batch).
- Serve downloads with **SAS URLs** directly from storage / CDN instead of streaming through the API.

**SAS tokens**: time-limited, scoped (container/blob, read/write) URLs. Prefer **user delegation SAS** (signed with Entra ID credentials) over account-key SAS; short expiry; HTTPS only.

**Monitoring costs**
- **Cost Management + Billing**: cost analysis by service/resource group/**tags** (project, environment, owner).
- **Budgets** with alert thresholds (e.g. 80%, 100%), anomaly alerts.
- **Azure Advisor** cost recommendations (idle resources, rightsizing, reserved instances / savings plans).

**Your story**: [what the data was, the policy you introduced, and the result — e.g. "storage cost down X% per month"].`,
  },
  {
    id: 'az-iac-scaling',
    category: 'Azure & DevOps',
    difficulty: 2,
    question: 'What is Infrastructure as Code (Bicep / Terraform)? Vertical vs horizontal scaling?',
    tldr: 'IaC describes infrastructure declaratively in versioned files deployed by the pipeline, so environments are reproducible and reviewable; vertical scaling = a bigger machine (simple, limited, often a restart), horizontal = more instances (needs a stateless app, near-unlimited, autoscaling).',
    answer: `**Infrastructure as Code**
- Infrastructure in git, reviewed in PRs, deployed by the pipeline; no "click-ops" differences between dev/test/prod.
- **Bicep**: Azure-native, compiles to ARM, no state file, day-one support for new Azure features.
- **Terraform**: multi-cloud, big ecosystem, keeps a **state file** (stored remotely with locking), \`plan\` shows changes before \`apply\`.
\`\`\`bicep
param location string = resourceGroup().location
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'plan-api-prod'
  location: location
  sku: { name: 'P1v3', capacity: 2 }
}
resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-api-prod'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: { serverFarmId: plan.id, httpsOnly: true }
}
\`\`\`

**Scaling**
- **Vertical (scale up)**: bigger SKU (more CPU/RAM). Easy, no code changes, but has a ceiling, costs grow non-linearly, may cause a restart, single point of failure stays.
- **Horizontal (scale out)**: more instances behind a load balancer. Needs a **stateless** app: no in-memory session, no local files, distributed cache, idempotent background jobs (or a single leader).
- **Autoscale** rules: CPU, memory, HTTP queue length, Service Bus queue length (KEDA); scale-in carefully (cooldowns).
- Databases scale differently: bigger tier, read replicas, partitioning, caching.`,
  },

  // =====================================================================
  // SECURITY & ENTRA ID
  // =====================================================================
  {
    id: 'sec-authn-authz-aspnet',
    category: 'Security & Entra ID',
    difficulty: 1,
    question: 'What is the difference between authentication and authorization? How do you do authorization in ASP.NET Core?',
    tldr: 'Authentication answers "who are you?" (validating a token/cookie → ClaimsPrincipal), authorization answers "what are you allowed to do?"; ASP.NET Core supports roles, claims, policies with requirements/handlers, and resource-based authorization via IAuthorizationService.',
    answer: `**Authentication (AuthN)**: establishes identity. In an API: JWT bearer middleware validates the token and creates \`HttpContext.User\` (claims). Failure → **401 Unauthorized**.

**Authorization (AuthZ)**: decides access for that identity. Failure → **403 Forbidden**.

**In ASP.NET Core**
\`\`\`csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("CanApproveForms", p => p.RequireRole("Approver"));
    o.AddPolicy("PlantManager", p => p.Requirements.Add(new PlantAccessRequirement()));
    o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build(); // secure by default
});

app.UseAuthentication();
app.UseAuthorization();

app.MapPost("/forms/{id}/approve", Approve).RequireAuthorization("CanApproveForms");
\`\`\`
- **Roles**: \`[Authorize(Roles = "Admin")]\` — simple, coarse.
- **Claims / policies**: named policies combining requirements (role, claim, scope, custom logic in an \`AuthorizationHandler\`). Preferred over role strings scattered in code.
- **Resource-based**: decision depends on the specific object (owner, plant, tenant) → \`IAuthorizationService.AuthorizeAsync(User, resource, "policy")\` (see the IDOR question).
- **FallbackPolicy** requiring an authenticated user means new endpoints are protected unless explicitly \`[AllowAnonymous]\`.`,
  },
  {
    id: 'sec-entra-login-flow',
    category: 'Security & Entra ID',
    difficulty: 3,
    question: 'How does sign-in with Entra ID work in your application, step by step?',
    tldr: 'SPA (Angular + MSAL) uses the authorization code flow with PKCE: redirect to Entra ID, user signs in (MFA, conditional access), the app exchanges the code for an ID token and an access token for the API scope; the API validates the JWT (signature, issuer, audience, expiry, scopes/roles).',
    answer: `**Setup (app registrations)**
- **API registration**: exposes scopes (\`api://forms-api/Forms.Read\`), defines **app roles** (\`Approver\`, \`Admin\`) assigned to users/groups.
- **SPA registration**: redirect URI, permission to call the API scopes.

**Flow (authorization code + PKCE)**
1. User opens the Angular app; MSAL sees no session → redirect to \`login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize\` with \`client_id\`, \`scope\`, \`redirect_uri\`, \`code_challenge\` (PKCE), \`state\`, \`nonce\`.
2. Entra ID authenticates the user (password/SSO, **MFA**, **Conditional Access** policies) and asks for consent if needed.
3. Redirect back with an **authorization code**.
4. MSAL exchanges code + \`code_verifier\` for tokens: **ID token** (who the user is, for the SPA), **access token** (audience = the API, scopes/roles), refresh token (short-lived for SPAs).
5. An **HttpInterceptor** (MsalInterceptor) attaches \`Authorization: Bearer <access token>\` to API calls; MSAL silently renews tokens.
6. The API (\`Microsoft.Identity.Web\`) validates the JWT: signature against Entra's published keys (JWKS), \`iss\`, \`aud\`, \`exp/nbf\`, required **scope** (\`scp\`) or **roles** claim.
7. Authorization policies use the roles/claims; resource-level checks in handlers.

**Service-to-service**
- **Client credentials** flow (daemon / background job): app identity, app roles, best with **Managed Identity** (no secret).
- **On-Behalf-Of (OBO)**: the API calls a downstream API *as the user*, exchanging the incoming token for a new one.

**Scopes vs app roles**: scopes = what the *application* is allowed to do on behalf of the user (delegated permissions); app roles = what the *user* (or app) is, assigned by admins → appear in the \`roles\` claim.

Draw this on a whiteboard as a sequence diagram — it is a strong moment in the interview.`,
  },
  {
    id: 'sec-jwt-dotnet',
    category: 'Security & Entra ID',
    difficulty: 2,
    question: 'What does a JWT consist of? Is the data in a JWT encrypted?',
    tldr: 'header.payload.signature, each Base64Url-encoded; it is signed (integrity and authenticity), not encrypted — anyone can read the claims, so never put secrets in it. Validate signature, issuer, audience, expiry, and keep access tokens short-lived with refresh tokens.',
    answer: `**Structure**: \`xxxxx.yyyyy.zzzzz\`
- **Header**: \`{"alg":"RS256","typ":"JWT","kid":"..."}\` — algorithm and key id.
- **Payload** (claims): \`iss\` (issuer), \`sub\` (subject), \`aud\` (audience), \`exp\`, \`nbf\`, \`iat\`, plus \`oid\`, \`tid\`, \`scp\`, \`roles\`, \`name\`…
- **Signature**: sign(header + "." + payload) with the issuer's private key (RS256) or a shared secret (HS256).

**Encrypted? No.** Base64Url is encoding — paste a token into jwt.ms and you can read it. The signature only proves it was issued by the trusted party and not modified. (JWE exists for encrypted tokens but is rare.)

**Validation checklist (the API side)**
- Signature with the right key (\`kid\` → JWKS from the issuer's metadata); **reject \`alg: none\`** and algorithm confusion.
- \`iss\` = expected tenant/issuer, \`aud\` = **this** API (otherwise a token for another API is accepted).
- \`exp\` / \`nbf\` with small clock skew; required scopes/roles.
\`\`\`csharp
.AddJwtBearer(o =>
{
    o.Authority = "https://login.microsoftonline.com/{tenant}/v2.0";
    o.Audience = "api://forms-api";
    o.TokenValidationParameters.ValidateLifetime = true;   // defaults validate issuer/audience/signature
});
\`\`\`

**Lifetime and refresh**
- Access tokens short (≈ 5–60 min) because they **can't be revoked** easily (stateless).
- **Refresh tokens** obtain new access tokens; rotate them, store securely (not in localStorage if you can avoid it; for SPAs MSAL keeps them in session/memory with short lifetimes; BFF pattern keeps tokens server-side with an HttpOnly cookie).
- Don't put PII or secrets in claims; keep tokens small.`,
  },
  {
    id: 'sec-idor-resource-based',
    category: 'Security & Entra ID',
    difficulty: 2,
    question: 'How can user A see user B\'s data (IDOR) and how do you prevent it? How do you enforce permissions on a specific resource, not just a role?',
    tldr: 'IDOR happens when the API trusts an id from the request (GET /forms/123) without checking that the caller may access that object; prevent it by always scoping queries to the current user/tenant and using resource-based authorization (IAuthorizationService + handlers), with tests for it.',
    answer: `**The bug**
\`\`\`csharp
app.MapGet("/forms/{id}", async (int id, AppDb db) => await db.Forms.FindAsync(id));   // any logged-in user, any id
\`\`\`
User A changes \`/forms/123\` to \`/forms/124\` and reads B's (or another power plant's) form. It is **Broken Access Control** — #1 in the OWASP Top 10. Role checks don't help: both users have the same role.

**Fix 1: scope the query to the caller**
\`\`\`csharp
var userPlants = user.GetPlantIds();
var form = await db.Forms.Where(f => f.Id == id && userPlants.Contains(f.PlantId)).SingleOrDefaultAsync(ct);
return form is null ? Results.NotFound() : Results.Ok(form.ToDto());   // 404, don't reveal existence
\`\`\`
For multi-tenant data, an EF Core **global query filter** (\`HasQueryFilter(f => f.TenantId == _tenant.Id)\`) makes it the default.

**Fix 2: resource-based authorization**
\`\`\`csharp
public class FormAuthorizationHandler : AuthorizationHandler<OperationAuthorizationRequirement, Form>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext ctx,
        OperationAuthorizationRequirement req, Form form)
    {
        if (ctx.User.HasPlant(form.PlantId) &&
            (req.Name == "Read" || ctx.User.IsInRole("Approver")))
            ctx.Succeed(req);
        return Task.CompletedTask;
    }
}

// in the handler
var result = await _authz.AuthorizeAsync(User, form, new OperationAuthorizationRequirement { Name = "Approve" });
if (!result.Succeeded) return Results.Forbid();
\`\`\`

**Also**
- Non-guessable ids (GUIDs) are defence-in-depth, **not** a fix.
- The same check for updates/deletes and for related resources (attachments, exports, SignalR groups).
- **Tests**: integration tests that call endpoints as user A for user B's resources and expect 403/404.
- **Excessive data exposure**: return DTOs, never entities (no hidden fields leaking, no over-posting on input).`,
  },
  {
    id: 'sec-sqli-xss-dotnet',
    category: 'Security & Entra ID',
    difficulty: 2,
    question: 'How do you protect against SQL injection and XSS in a .NET + Angular application?',
    tldr: 'SQL injection: parameterised queries only (EF Core LINQ, FromSql with interpolation, Dapper parameters), never string concatenation, least-privilege DB user. XSS: Angular escapes bindings by default, so avoid bypassSecurityTrust* and innerHTML with untrusted data, add a Content Security Policy, and encode output on the server.',
    answer: `**SQL injection**
\`\`\`csharp
// BAD: string concatenation
db.Users.FromSqlRaw("SELECT * FROM Users WHERE Name = '" + name + "'");

// GOOD: parameterised (the interpolation becomes a DbParameter)
db.Users.FromSql($"SELECT * FROM Users WHERE Name = {name}");
await conn.QueryAsync<User>("SELECT * FROM Users WHERE Name = @name", new { name });   // Dapper
\`\`\`
- LINQ queries in EF Core are parameterised automatically.
- Dynamic **column names / ORDER BY** can't be parameters → map to an allow-list.
- Defence in depth: least-privilege DB login (Managed Identity, no \`db_owner\`), stored procedures don't help if they concatenate internally.

**XSS (Cross-Site Scripting)**
- **Angular** treats all bindings (\`{{ }}\`, \`[innerHTML]\`) as untrusted and sanitises them. Risk comes from \`bypassSecurityTrustHtml\`, direct DOM manipulation (\`nativeElement.innerHTML\`), or third-party libraries.
- Server-side Razor encodes output by default; \`Html.Raw\` is the danger.
- **Content-Security-Policy** header (no inline scripts, allowed origins), \`HttpOnly\` cookies so script can't read them.
- Validate input, but **encode on output** for the right context.

**CSRF**: relevant with cookie auth (the browser sends cookies automatically) → antiforgery tokens, \`SameSite\` cookies. Bearer tokens in headers are not sent automatically → not vulnerable to classic CSRF.

**SSRF**: the server fetches a URL supplied by the user → allow-list hosts, block internal IP ranges and the metadata endpoint.

**Security headers**: HSTS + HTTPS redirect, CSP, \`X-Content-Type-Options: nosniff\`, \`frame-ancestors\` / X-Frame-Options, Referrer-Policy.`,
  },
  {
    id: 'sec-cors-dotnet',
    category: 'Security & Entra ID',
    difficulty: 2,
    question: 'What is CORS and why does the browser block a request?',
    tldr: 'The same-origin policy stops scripts from reading responses from another origin; CORS is the server opting in via Access-Control-Allow-* headers (with a preflight OPTIONS for non-simple requests). It is enforced by the browser, protects users, and is not an API security mechanism.',
    answer: `**Origin** = scheme + host + port. \`https://app.example.com\` → \`https://api.example.com\` is cross-origin.

**What happens**
- **Simple requests** (GET/POST with simple headers): sent, but the browser hides the response from JS unless it has \`Access-Control-Allow-Origin\` matching the origin.
- **Preflight**: for \`PUT/DELETE\`, \`Content-Type: application/json\`, or an \`Authorization\` header, the browser first sends \`OPTIONS\` with \`Access-Control-Request-Method/Headers\`. If the response doesn't allow them, the real request is never sent.
- The error appears in the browser console; Postman/curl don't care (no browser = no CORS).

**ASP.NET Core**
\`\`\`csharp
builder.Services.AddCors(o => o.AddPolicy("spa", p => p
    .WithOrigins("https://forms.example.com")     // explicit list, from config per environment
    .AllowAnyHeader()
    .WithMethods("GET", "POST", "PUT", "DELETE")
    .AllowCredentials()));                         // only if you use cookies

app.UseCors("spa");                                // before auth and endpoints
\`\`\`

**Mistakes**
- \`AllowAnyOrigin()\` with credentials (not allowed by spec) or reflecting any \`Origin\` header back → any site can call your API with the user's cookies.
- Thinking CORS protects the API: attackers use curl. Authentication/authorisation protect the API; CORS protects users' browsers.
- Wrong middleware order (CORS after endpoints/auth → preflight returns 401).

**Avoid CORS altogether**: serve SPA and API from the same origin (reverse proxy, Static Web Apps linked API, BFF).`,
  },
  {
    id: 'sec-oauth-oidc-dotnet',
    category: 'Security & Entra ID',
    difficulty: 2,
    question: 'OAuth 2.0 vs OpenID Connect: what is the difference? Which flows do you use?',
    tldr: 'OAuth 2.0 is delegated authorization (an access token to call an API); OpenID Connect is an identity layer on top that adds the ID token and user info for authentication. Use authorization code + PKCE for user apps, client credentials for service-to-service, and on-behalf-of for API chains.',
    answer: `**OAuth 2.0**: "allow this app to access that API (on my behalf)". Issues **access tokens** whose audience is a resource server. It says nothing standard about who the user is.

**OpenID Connect (OIDC)**: adds **authentication**: the \`openid\` scope, an **ID token** (JWT about the user, audience = the client app), \`/userinfo\`, discovery (\`.well-known/openid-configuration\`), standard claims.

**Rule**: ID token → for the client, to know who logged in. Access token → for the API. Never send the ID token to an API as authorisation.

**Flows**
- **Authorization code + PKCE**: web apps, SPAs, mobile. PKCE (code_verifier/code_challenge) protects public clients from code interception. The **implicit flow** is deprecated.
- **Client credentials**: no user; daemon/background services. In Azure prefer **Managed Identity** or **workload identity federation** over client secrets.
- **On-Behalf-Of** (Entra ID): an API exchanges the user's token for a token to a downstream API.
- **Device code**: CLI / TV devices.
- **Resource Owner Password**: legacy, avoid (app sees the password, no MFA).

**Refresh tokens**: long-lived, used to obtain new access tokens; rotate and protect them.`,
  },
  {
    id: 'sec-blocked-unsafe-solution',
    category: 'Security & Entra ID',
    difficulty: 2,
    question: 'Tell me about a situation when you blocked an unsafe solution proposed by the client.',
    tldr: 'STAR story: the client wanted something risky under time pressure, you explained the concrete risk in business terms, proposed a safe alternative that still met the goal, and the result was accepted — show courage plus pragmatism, not a "no".',
    answer: `**Structure (STAR)** — fill in your real details:
- **Situation**: [project under pressure, the client proposed e.g. sharing one admin account, sending data/credentials by e-mail, disabling authorization for an integration, exposing a storage account publicly, storing secrets in config…]
- **Task**: you were responsible for [the feature / the security of the solution].
- **Action**:
  - Named the **concrete risk** in business language: "anyone with the link can download all plant reports", "we fail the audit / GDPR", "one leaked password = access to everything".
  - Did not just refuse — **proposed an alternative** with similar effort: SAS links with expiry, Managed Identity, a dedicated role, a separate least-privilege endpoint.
  - Estimated the cost of the alternative and, if needed, escalated with a short written summary (decision log) so it was a conscious business decision.
- **Result**: [what was implemented, deadline kept?, feedback from the client / colleagues — "colleagues praise you for catching security risks"].
- **Lesson**: raise security early (threat modelling in refinement) so it isn't a last-minute blocker.

**What the interviewer checks**: technical judgement, communication with non-technical people, assertiveness without being a blocker.

**Avoid**: badmouthing the client ("they were clueless", "toxic environment") — say "a project under heavy time pressure".`,
  },

  // =====================================================================
  // TESTING
  // =====================================================================
  {
    id: 'test-project-strategy',
    category: 'Testing (.NET)',
    difficulty: 2,
    question: 'What does testing look like in your project? How do unit and integration tests differ?',
    tldr: 'Unit tests check one piece of logic in isolation (fast, no I/O); integration tests check components working together with real infrastructure (database, HTTP pipeline). Describe your real mix, the tools (xUnit, NSubstitute/Moq, WebApplicationFactory, Testcontainers), how they run in CI, and one thing you would improve.',
    answer: `**Unit test**
- One unit of behaviour (domain method, handler, validator), dependencies replaced by fakes, no DB/network/file system. Milliseconds; hundreds run on every build.

**Integration test**
- Several real components together: API pipeline + DI + EF Core + a real database, or a repository against SQL Server. Slower, catches what mocks hide: SQL translation, mappings, serialisation, auth, middleware order.

**E2E / UI tests**: the whole system through the UI (Playwright). Few, for critical paths.

**Test pyramid / trophy**: many fast unit tests for logic-heavy code, a solid layer of integration tests for the API, very few E2E tests. For CRUD-heavy APIs, integration tests give the most confidence per test ("testing trophy").

**xUnit essentials**
\`\`\`csharp
public class PriceCalculatorTests
{
    [Theory]
    [InlineData(100, 0, 100)]
    [InlineData(100, 10, 90)]
    public void Applies_discount(decimal price, int percent, decimal expected) =>
        Assert.Equal(expected, PriceCalculator.Apply(price, percent));
}
\`\`\`
- \`[Fact]\` / \`[Theory]\` + \`InlineData\` / \`MemberData\`; a new class instance per test (constructor = setup, \`IDisposable\` = teardown); shared expensive setup via \`IClassFixture<T>\` / \`ICollectionFixture<T>\`. NUnit equivalents: \`[Test]\`, \`[TestCase]\`, \`[SetUp]\`, \`[OneTimeSetUp]\`.

**Your answer (prepare honestly)**: [what you have today — e.g. unit tests for domain/handlers, some integration tests, manual testing by testers — how they run in the pipeline, and one improvement: "I'd add Testcontainers-based API tests for the critical flows"].`,
  },
  {
    id: 'test-what-to-mock',
    category: 'Testing (.NET)',
    difficulty: 2,
    question: 'What do you mock and what not?',
    tldr: 'Mock things you don’t own or that are slow/non-deterministic at the boundary (external HTTP APIs, e-mail, message bus, clock); don’t mock your own domain objects, value objects or the database you can run for real — over-mocking couples tests to implementation.',
    answer: `**Mock / fake**
- External services: payment gateway, SMTP, third-party APIs (\`HttpMessageHandler\` stub or WireMock.Net).
- Message bus publishing (assert that an event was published).
- Time (\`TimeProvider\`), randomness, GUID generation.
- Slow or flaky infrastructure **in unit tests**.

**Don't mock**
- Domain entities, value objects, DTOs, pure functions — use the real thing.
- The DbContext / IQueryable — mocking LINQ is painful and proves nothing about SQL. Use a real database in integration tests.
- Everything in a call chain "because it's a dependency": tests then mirror the implementation and break on every refactor.

\`\`\`csharp
// NSubstitute
var email = Substitute.For<IEmailSender>();
var handler = new ApproveFormHandler(db, email, timeProvider);
await handler.Handle(new ApproveForm(formId), default);
await email.Received(1).SendAsync(Arg.Is<Email>(e => e.To == "owner@plant.com"), Arg.Any<CancellationToken>());

// Moq equivalent
var mock = new Mock<IEmailSender>();
mock.Verify(m => m.SendAsync(It.IsAny<Email>(), It.IsAny<CancellationToken>()), Times.Once);
\`\`\`

**Vocabulary**: **stub** returns canned data, **mock** verifies interactions, **fake** is a working lightweight implementation (in-memory repository), **spy** records calls.

**Rule**: prefer asserting on **state / outputs** over interactions; verify interactions only for side effects that are the point of the behaviour (an e-mail was sent).`,
  },
  {
    id: 'test-api-with-db',
    category: 'Testing (.NET)',
    difficulty: 3,
    question: 'How do you test an API endpoint together with the database? Why is EF Core InMemory not good for everything?',
    tldr: 'WebApplicationFactory hosts the real app in memory with an HttpClient, and Testcontainers starts a real SQL Server/PostgreSQL in Docker; InMemory is not a relational database — no SQL translation, constraints, transactions or real query behaviour — so tests pass while production fails.',
    answer: `\`\`\`csharp
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder().Build();   // Testcontainers

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseSqlServer(_db.GetConnectionString()));
            services.AddAuthentication("Test")
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });
        });

    public async Task InitializeAsync()
    {
        await _db.StartAsync();
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    }
    public new Task DisposeAsync() => _db.DisposeAsync().AsTask();
}

public class FormsApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Create_then_get_returns_the_form()
    {
        var client = factory.CreateClient();
        var created = await client.PostAsJsonAsync("/forms", new { title = "Inspection" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var form = await client.GetFromJsonAsync<FormDto>(created.Headers.Location);
        Assert.Equal("Inspection", form!.Title);
    }
}
\`\`\`
- Tests the real pipeline: routing, model binding, validation, auth policies, serialisation, EF mappings and SQL.
- Isolation between tests: a transaction rolled back per test, or **Respawn** to reset data, or unique data per test.
- Fake the authentication with a test scheme to test as different users (great for IDOR tests).

**Why not EF Core InMemory**
- Not relational: no SQL is generated, so LINQ that SQL Server can't translate passes.
- No foreign keys / unique constraints, no transactions, no \`RowVersion\` concurrency, case sensitivity differs, raw SQL and \`ExecuteUpdate\` don't work.
- Microsoft itself recommends against it for testing. **SQLite in-memory** is closer but still a different engine.
- InMemory is OK for quick tests of logic that just needs *some* store.`,
  },
  {
    id: 'test-datetime-now',
    category: 'Testing (.NET)',
    difficulty: 1,
    question: 'How do you test code that depends on DateTime.Now?',
    tldr: 'Don’t call DateTime.Now/UtcNow directly; inject TimeProvider (.NET 8) — or your own IClock — and in tests use FakeTimeProvider to set and advance time deterministically, including timers and delays.',
    answer: `\`\`\`csharp
public class SubscriptionService(TimeProvider time)
{
    public bool IsExpired(Subscription s) => time.GetUtcNow() > s.ExpiresAt;
}

builder.Services.AddSingleton(TimeProvider.System);   // production

// test (Microsoft.Extensions.TimeProvider.Testing)
var time = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
var sut = new SubscriptionService(time);
var sub = new Subscription { ExpiresAt = time.GetUtcNow().AddDays(30) };

Assert.False(sut.IsExpired(sub));
time.Advance(TimeSpan.FromDays(31));
Assert.True(sut.IsExpired(sub));
\`\`\`
- \`TimeProvider\` also abstracts **timers and delays**: \`Task.Delay(TimeSpan, timeProvider)\`, \`CreateTimer\` → tests for retries, timeouts and background jobs run instantly.
- Before .NET 8: a custom \`IClock\` / \`ISystemClock\` interface.
- Use **UTC** (\`DateTimeOffset\`) in storage and logic; convert to local time only in the UI.

**General testability rules**: dependencies via constructor injection, no static access to I/O, time, config or randomness, small pure functions for business rules.`,
  },
  {
    id: 'test-tdd-coverage',
    category: 'Testing (.NET)',
    difficulty: 2,
    question: 'What do you think about TDD? Do you use it? Why is 100% code coverage not the goal?',
    tldr: 'TDD (red → green → refactor) is great for well-defined logic and bug fixes, less so for exploratory UI or glue code; coverage shows what is NOT tested, but 100% invites shallow tests of trivial code — mutation testing and testing important behaviour matter more.',
    answer: `**TDD cycle**: write a failing test (**red**) → minimal code to pass (**green**) → **refactor** with the tests as a safety net.

**Where it shines**
- Business rules and calculations, parsers, validators, state machines.
- **Bug fixes**: write the test that reproduces the bug first — proves the fix and prevents regressions.
- Drives a better design: small units, explicit dependencies.

**Where I'm pragmatic**
- Exploratory work, spikes, UI layout, thin glue code → test after, or integration tests.
- Honest answer: "I use test-first for logic and bugs; not dogmatically for everything." Don't claim strict TDD if you don't do it — follow-up questions will expose it.

**Code coverage**
- Useful to find **untested areas** and as a trend; e.g. a soft gate on new code.
- 100% as a target leads to tests of getters/DTOs and tests without meaningful asserts, while edge cases stay untested — high coverage ≠ good tests.
- **Mutation testing** (Stryker.NET) checks whether tests actually fail when code changes.
- Focus coverage on critical paths: money, permissions, data integrity.`,
  },
  {
    id: 'test-collab-testers',
    category: 'Testing (.NET)',
    difficulty: 1,
    question: 'How do you work with testers?',
    tldr: 'As one team: involve QA early (acceptance criteria and edge cases in refinement), make features testable (test data, environments, logs), analyse bugs together quickly instead of ping-pong, and automate regression — your story: joint bug analysis with testers without delays.',
    answer: `**Principles**
- **Shift left**: testers in refinement; agree acceptance criteria and edge cases before coding (Given/When/Then).
- **Testability**: seed data, feature flags, a stable test environment, meaningful error messages and correlation ids in logs so a bug report can be traced in App Insights.
- **Fast feedback loop**: when a bug comes in, reproduce it together (call / pairing), not ticket ping-pong. Agree on severity and whether it blocks the release.
- **Automation split**: developers write unit/integration tests; QA focuses on exploratory testing, E2E for critical paths, regression suites.
- Respect: a bug found by QA is a success of the process, not an attack.

**Your story (STAR)** — from the head of testing's feedback:
- **Situation**: [many bugs at the end of a sprint / a tight release]
- **Action**: [e.g. you sat with testers to analyse failures together, added logs/test data, fixed in priority order, explained root causes]
- **Result**: [no delays in the release, fewer reopened bugs, positive feedback from the head of testing].`,
  },
]);
