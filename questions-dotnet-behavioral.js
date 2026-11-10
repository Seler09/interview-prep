/*
  .NET TRACK: BEHAVIORAL & STORIES, RECRUITER SCREENING
  Answers are frameworks + pointers to YOUR stories. Replace every [placeholder] with real facts
  before the interview; never invent numbers you can't defend.
  Format: see the comment at the top of questions.js
*/
addQuestions('dotnet', [
  // =====================================================================
  // BEHAVIORAL & STORIES
  // =====================================================================
  {
    id: 'beh-star-story-bank',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'How do you prepare for behavioral questions? Which of your stories fits which question?',
    tldr: 'Use STAR (Situation, Task, Action, Result) with the emphasis on YOUR actions and a measurable result; prepare 8–10 stories and map each to several question types, so you adapt a ready story instead of improvising.',
    answer: `**STAR**: Situation (2 sentences of context) → Task (your responsibility) → **Action** (60% of the time: what *you* did, "I", not "we") → **Result** (numbers, feedback, what you learned). 1.5–2.5 minutes.

| Story | Shows | Fits questions about |
|---|---|---|
| Package Management System from scratch to production in 6 months | ownership, leading a project | biggest achievement, leadership, deadlines |
| Dropping a feature from scope in the Incident Logging System | maturity, working with the client | disagreeing with a client, saying "no" |
| Blocking unsafe solutions proposed by the client | security, courage | conflict, quality under pressure |
| Leading the OST integration on your own | autonomy, communication | unclear requirements, ownership |
| Mediator in the team on a difficult project | emotional intelligence | team conflict, supporting others |
| Recruitment, onboarding, introducing UX into the app | mentoring | knowledge sharing, working with people |
| Joint bug analysis with testers without delays | problem solving | hardest bug, collaboration |
| Migration from .NET Framework to .NET 5 | technical depth, legacy | hardest technical problem |
| Presentation to the client's head of Product Owners | communication | presenting, working with business |
| Won hackathon | teamwork, initiative | team, creativity |
| **[to fill in]** A mistake you learned from | humility, learning | failure, mistake |

**Rules**
- Say "a project under heavy time pressure", never "a toxic client".
- Each story: one sentence of **lesson learned** at the end.
- Prepare "Tell me about yourself" in **Polish and English**.`,
  },
  {
    id: 'beh-about-me-dotnet',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'Tell me about yourself (2 minutes, in Polish and in English).',
    tldr: 'Present → past → future in ~2 minutes: who you are now (Senior .NET, Azure, full-stack with Angular), 2–3 highlights with impact (projects from your CV), what you are strong at, and why this role is the logical next step.',
    answer: `**Structure**
1. **Present (20 s)**: "I'm a .NET developer with [X] years of experience, currently [role] at [company], building [type of systems] on ASP.NET Core and Azure, with Angular on the front end."
2. **Highlights (60 s)**: 2–3 achievements with impact:
   - Package Management System: [built from scratch to production in 6 months, your role].
   - Incident Logging System: [moved to CQRS/MediatR — what it improved].
   - [Forms platform for 300 power plants / 6,000 users, Entra ID, Event Grid, cost reduction in Blob Storage…]
3. **Strengths (20 s)**: e.g. ownership, spotting security risks early, working directly with the client, mentoring.
4. **Future (20 s)**: "Now I'm looking for a backend-focused senior role where I can [own architecture / grow towards Tech Lead / work on a product at scale] — which is why this position interests me."

**English opener example**: "I'm a backend-oriented .NET developer with [X] years of experience. Most recently I [built …]. I'm strongest at […], and I'm looking for […]."

**Tips**: don't recite the CV chronologically, keep it under 2 minutes, end with a hook that invites a follow-up question, practise out loud until it sounds natural, not memorised.`,
  },
  {
    id: 'beh-why-change',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'Why are you changing jobs?',
    tldr: 'Positive and forward-looking: what you want to move towards (backend depth, product scale, architecture/Tech Lead path, technologies), not what you are running from; never criticise the current employer or client.',
    answer: `**Formula**: appreciation for what you learned → what you're looking for now → why this role matches.

**Example**: "I've learned a lot in my current company — I delivered projects end to end and worked directly with clients. Now I'd like to focus more deeply on backend and architecture, in a team where [product scale / distributed systems / Azure-native architecture] is the core of the work, with a path towards a Tech Lead role. That's what attracted me to this position."

**Avoid**
- Complaining about the client, management, the "toxic environment" — use "a project under strong time pressure" if you must mention it.
- Money as the main reason (even if it matters — talk about it in the conditions part).
- Sounding like you'd leave the next job just as fast.`,
  },
  {
    id: 'beh-why-us',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'Why our company?',
    tldr: 'Show you did your homework: connect 2–3 specifics about the company (product, domain, tech stack, engineering culture, growth) with your experience and goals.',
    answer: `**Before the interview**: read the job ad, website, engineering blog/tech talks, LinkedIn of the team, Glassdoor reviews, what the product does and who uses it.

**Formula**: "[Specific thing about the company] + [why it matters to me] + [what I bring]".

**Example**: "You build [product] used by [users] — I like working on systems with real impact. Your stack (ASP.NET Core, Azure, event-driven architecture) is exactly what I've worked with in [project], and I see in the ad that you're [migrating legacy / scaling / building a new platform], where my experience with [.NET Framework → .NET migration / CQRS / Azure] would be useful from day one."

**Avoid**: generic answers ("you're a big, stable company"), only benefits, not knowing what the company does.`,
  },
  {
    id: 'beh-biggest-achievement',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'What is your biggest professional achievement?',
    tldr: 'Package Management System from zero to production in 6 months: explain the stakes, your ownership (architecture, decisions, coordination), the obstacles, and the measurable result.',
    answer: `**STAR — Package Management System** (fill in):
- **Situation**: [client, problem the system solved, why the deadline mattered].
- **Task**: [your role: lead developer / owner of the backend / architecture decisions; team size].
- **Action**:
  - [key technical decisions: architecture, Azure services, data model, integrations]
  - [how you organised the work: priorities, scope management, MVP first]
  - [risks you handled: unclear requirements, integration problems, deadline pressure]
  - [how you worked with the client and the team]
- **Result**: [delivered to production in 6 months; users / packages per day; stability after go-live; feedback].
- **Lesson**: [e.g. cutting scope early protects the deadline; investing in CI/CD early paid off].

**Why this story**: it shows ownership and delivery end to end — the strongest signal for a senior role.`,
  },
  {
    id: 'beh-hardest-technical',
    category: 'Behavioral & Stories',
    difficulty: 2,
    question: 'What is the hardest technical problem you have solved?',
    tldr: 'Pick a story with real technical depth (e.g. the .NET Framework → .NET 5 migration or a hard production bug): explain why it was hard, how you investigated systematically, the options you considered, and the outcome.',
    answer: `**Good candidates**: the .NET Framework → .NET 5 migration, a tricky bug found together with testers, a performance problem.

**STAR + technical depth**
- **Situation / why hard**: [legacy code without tests, System.Web dependencies, unsupported libraries, production-only bug, concurrency issue…]
- **Investigation**: how you narrowed it down — logs/App Insights, reproducing, profiling, bisecting, reading library source.
- **Options & trade-offs**: [big-bang vs incremental migration with a strangler fig; rewrite vs wrap a library] and why you chose one.
- **Action**: [the concrete steps you took].
- **Result**: [measurable: performance, hosting cost, deployment on Linux/containers, fewer incidents].
- **Lesson**: [what you'd do differently, e.g. add characterisation tests first].

**Expect follow-ups**: "Why not X?", "What would you do with twice the time?", "How did you verify it?" — know the details.`,
  },
  {
    id: 'beh-disagree-client',
    category: 'Behavioral & Stories',
    difficulty: 2,
    question: 'Tell me about a situation when you disagreed with a client or your manager.',
    tldr: 'The Incident Logging System scope story: you disagreed with including a feature, backed your view with data (cost, risk, deadline), proposed an alternative, respected the final decision-maker — and the outcome showed it was the right call.',
    answer: `**STAR — removing a feature from scope in the Incident Logging System** (fill in):
- **Situation**: [the client wanted feature X in release Y; deadline / budget pressure].
- **Task**: [you were responsible for delivery / technical estimation].
- **Action**:
  - Understood **why** they wanted it (the underlying need).
  - Prepared facts: effort, risk to the deadline, impact on quality / other features.
  - Proposed alternatives: a simpler version, moving it to the next release, a manual workaround.
  - Discussed it openly with the client / PO, not behind their back; documented the decision.
- **Result**: [feature postponed/simplified, deadline kept, client satisfied, maybe they later admitted it wasn't needed].
- **Lesson**: disagree with data and options, then commit to the decision ("disagree and commit").

**Key signals**: respect, business thinking, not stubbornness. If you lost the argument, say how you still delivered well.`,
  },
  {
    id: 'beh-team-conflict',
    category: 'Behavioral & Stories',
    difficulty: 2,
    question: 'Tell me about a conflict in the team and how you resolved it.',
    tldr: 'The “mediator in a difficult project” story: describe the tension neutrally, how you listened to both sides privately, found the shared goal and a concrete agreement, and what improved afterwards.',
    answer: `**STAR — mediator in the team** (fill in):
- **Situation**: [project under heavy time pressure; tension between X and Y / between developers and testers / about a technical approach].
- **Task**: [you weren't formally the lead, but the conflict was hurting delivery and morale].
- **Action**:
  - Talked to each person **one on one**, listened, separated facts from emotions.
  - Found the common goal (release, quality) and the real cause (unclear responsibilities, pressure, misunderstanding).
  - Proposed a concrete agreement: [e.g. clear ownership, a short daily sync, code review rules, a decision made on criteria].
  - Followed up after a few days.
- **Result**: [cooperation improved, delivery on time, feedback from the team / manager].
- **Lesson**: conflicts are usually about process or pressure, not people — address them early.

**Avoid**: blaming one person, presenting yourself as the hero who was always right.`,
  },
  {
    id: 'beh-mistake-learned',
    category: 'Behavioral & Stories',
    difficulty: 2,
    question: 'Tell me about a mistake you made. What did you learn?',
    tldr: 'Choose a real, moderately serious mistake you owned: what happened, how you fixed it quickly and transparently, the root cause, and the concrete change in your process that prevents it now.',
    answer: `**This story is still [to fill in] — prepare it before the interview.**

**Good shapes**
- A deployment / migration that broke something in production → you rolled back, communicated, added a check to the pipeline.
- Underestimating a task and telling people too late → now you raise risks early and split work smaller.
- A security or data issue you introduced and caught → you added tests / a review checklist.

**STAR**
- **Situation & mistake**: what happened, said plainly — "I made a mistake: …".
- **Immediate action**: how you limited the impact and who you informed.
- **Root cause**: why it happened (not "bad luck").
- **Change**: what you do differently now (process, tests, checklist) — with proof it works.

**Avoid**: fake weaknesses ("I worked too hard"), blaming others, a catastrophic mistake with no lesson.`,
  },
  {
    id: 'beh-pressure',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'How do you work under time pressure?',
    tldr: 'Prioritise ruthlessly (must-have vs nice-to-have), communicate risks early, cut scope rather than quality on critical things (security, data), and keep the team calm — illustrate with a real deadline story.',
    answer: `**What to say**
- Clarify what really matters for the deadline; split into must-have / nice-to-have; propose scope cuts early.
- Make progress visible: small increments, daily status, raise risks as soon as you see them (no surprises on the last day).
- Protect non-negotiables: security, data integrity, tests for critical paths — pressure is when bugs and shortcuts are most expensive.
- Stay calm and supportive in the team; pressure is temporary, burnout isn't.

**Example**: Package Management System delivered in 6 months, or the project "under heavy time pressure" where you [blocked an unsafe shortcut / dropped a feature from scope] and still hit the date.`,
  },
  {
    id: 'beh-unclear-requirements',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'What do you do when the requirements are unclear?',
    tldr: 'Don’t guess silently: ask targeted questions, write down assumptions and confirm them, build a small slice or prototype to get feedback fast, and keep the design easy to change — the OST integration story fits here.',
    answer: `**Approach**
- Find out the **goal** behind the request (the problem, not the solution).
- Ask specific questions; bring examples and edge cases; talk to the actual users / the owner of the other system.
- Write down **assumptions** and get them confirmed (a short message / ticket comment).
- Deliver a thin vertical slice or a prototype early → feedback from real behaviour beats long documents.
- Design for change where uncertainty is high (adapters around external systems, feature flags).

**STAR — leading the OST integration on your own** (fill in): [missing/unclear documentation of the external system, how you got answers, what you built first, how you kept stakeholders updated, the result].`,
  },
  {
    id: 'beh-onboarding-mentoring',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'How do you onboard new people to the team?',
    tldr: 'A prepared setup (working dev environment, docs, architecture overview), a buddy, a small real first task delivered in the first days, pairing and good code reviews, and regular check-ins — plus your story of recruitment, onboarding and introducing UX practices.',
    answer: `**What works**
- **Before day 1**: access, working local setup script / dev container, README with architecture overview and how to run tests.
- **Buddy** for questions; short sessions on the domain and architecture (draw the system).
- **First task** small and real (a bug or a small feature) → first PR merged in the first days builds confidence.
- **Pairing** and **code reviews** as a teaching tool: explain *why*, not just "change this".
- Gradually bigger tasks; regular 1:1 check-ins; ask for feedback to improve the onboarding docs.

**Your story** (fill in): [you took part in recruitment interviews, onboarded N people, created docs/checklists, introduced UX practices into the app — the result: faster ramp-up, better quality].`,
  },
  {
    id: 'beh-feedback-received',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'What feedback did you receive recently and what did you do with it?',
    tldr: 'Use the architect’s feedback about operations and observability: you accepted it, made a plan (Application Insights, KQL, alerts, OpenTelemetry, pipelines), and show concrete progress — it proves self-awareness and growth.',
    answer: `**Example structure**
- **Feedback**: "The architect told me my strength is [delivery / security awareness / client work], and my area to grow is the **operational side and observability**."
- **What I did**: [learned App Insights in depth — distributed tracing, KQL queries, alerts and dashboards; OpenTelemetry; took part in incident analysis; improved the CI/CD pipeline; maybe started AZ-204/AZ-400 material].
- **Result**: [e.g. built a dashboard/alert that caught a problem early; can now diagnose slow requests end to end].

**Also mention positive feedback**: colleagues praise you for catching security risks; the head of testing for good collaboration — but the growth story is the more valuable part.

**Signals**: you seek feedback, don't get defensive, and turn it into action.`,
  },
  {
    id: 'beh-strengths-weaknesses',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'What are your strengths and weaknesses?',
    tldr: 'Strengths backed by evidence (ownership, security awareness, client communication, mentoring); one genuine weakness that isn’t critical for the role, plus what you are actively doing about it (e.g. operations/observability depth).',
    answer: `**Strengths (pick 2–3 with proof)**
- **Ownership / delivery**: Package Management System from zero to production in 6 months.
- **Security awareness**: colleagues value you for spotting security risks; blocked unsafe solutions.
- **Working with the business**: presentations to the client's head of POs, managing scope.
- **People**: mentoring, onboarding, mediating conflicts.

**Weakness (real, not fatal, with an action plan)**
- e.g. "Operational depth — observability and running systems in production. Feedback from an architect confirmed it, so I [learned App Insights/KQL, set up alerts, studied OpenTelemetry], and I want to grow there further."
- or "I tend to take on too much myself instead of delegating — I now [split work explicitly / ask for help earlier]."

**Avoid**: "I'm a perfectionist", weaknesses that are core to the job ("I don't like writing code"), or none at all.`,
  },
  {
    id: 'beh-led-team',
    category: 'Behavioral & Stories',
    difficulty: 2,
    question: 'Have you led a team or a project? What did it look like?',
    tldr: 'Even without the formal title: describe the scope you owned (Package Management System, OST integration), how you planned, split work, made technical decisions, communicated with the client, handled risks, and supported people.',
    answer: `**Show leadership without needing the title**
- **Scope**: [project / module / integration], team of [N], your responsibilities.
- **Planning**: breaking work down, estimating, priorities with the PO/client, managing scope.
- **Technical direction**: architecture decisions and how you made them (options, trade-offs, ADRs), code review standards.
- **People**: unblocking others, mentoring, onboarding, mediating.
- **Communication**: status for stakeholders, presenting to the client's PO lead, raising risks.
- **Result**: delivered [what, when], quality, what the team said.

**If the answer is "not formally"**: "Formally no, but in [project] I effectively led the technical side: …" — that is exactly what they want to hear for a Tech Lead path.`,
  },
  {
    id: 'beh-3-5-years',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'Where do you see yourself in 3–5 years?',
    tldr: 'A credible path that fits the company: growing from Senior into Tech Lead / architecture responsibility — deeper Azure and distributed systems expertise, leading technical decisions and mentoring — while staying hands-on.',
    answer: `**Example**: "In 3–5 years I'd like to be a Tech Lead: responsible for the technical direction of a product or a team, still hands-on in code, but also mentoring others and working closely with the business. To get there I want to deepen my architecture and cloud skills — distributed systems, observability, Azure (e.g. AZ-204 / AZ-305) — and take on more ownership step by step."

**Tips**
- Connect it with what the company offers (ask about the Tech Lead path at the end).
- Show ambition without signalling you'll leave soon or want the interviewer's job.
- Keep a learning angle: certifications, conferences, community.`,
  },
  {
    id: 'beh-staying-current',
    category: 'Behavioral & Stories',
    difficulty: 1,
    question: 'How do you develop yourself and stay up to date?',
    tldr: 'Name concrete, current sources and habits: .NET release notes and blogs, conference talks (.NET Conf, NDC), newsletters, podcasts, side projects or proofs of concept, certifications, sharing knowledge in the team — plus something you learned recently.',
    answer: `**Concrete is convincing**
- **Sources**: .NET blog and release notes (what's new in .NET 9/10, C# 13/14), Andrew Lock, Nick Chapsas, Milan Jovanović, Steve Smith / Ardalis, Microsoft Learn, ThePrimeagen/Fireship for general tech, .NET Conf / NDC talks.
- **Practice**: side projects and PoCs (e.g. trying Aspire, HybridCache, OpenTelemetry), reading open-source code.
- **Certifications**: [AZ-204 in progress / planned].
- **Team**: knowledge-sharing sessions, code reviews, hackathons (you won one!).
- **AI tools**: how you use them to learn faster (and verify).

**Prepare one example**: "Recently I learned X and used it in Y" — interviewers often ask "what was the last thing you learned?"`,
  },
  {
    id: 'beh-disagree-tech-decision',
    category: 'Behavioral & Stories',
    difficulty: 2,
    question: 'Tell me about a technical decision you disagreed with.',
    tldr: 'Explain the decision and your concern objectively, how you raised it with arguments or a quick experiment, how the decision was made, and that you committed to it afterwards — plus what the outcome taught you.',
    answer: `**STAR** (fill in a real one):
- **Situation**: [e.g. choice of library/architecture (MediatR everywhere, microservices too early, a generic repository, a hosting option), proposed by a lead/architect/team].
- **Your concern**: [complexity, cost, risk, time] — stated as trade-offs, not opinions.
- **Action**: raised it in the right forum (design review, ADR comment), brought data or a small spike/PoC, proposed an alternative or a way to limit the risk.
- **Decision**: [accepted / partly accepted / rejected] — and you **committed** and helped make it work.
- **Outcome / lesson**: [what happened later; what you learned about influencing decisions].

**Signals**: technical judgement + maturity: "strong opinions, loosely held", no grudges.`,
  },

  // =====================================================================
  // RECRUITER SCREENING & CONDITIONS
  // =====================================================================
  {
    id: 'rec-salary-expectations',
    category: 'Recruiter & Conditions',
    difficulty: 2,
    question: 'What are your salary expectations? (UoP gross and B2B net)',
    tldr: 'Prepare researched ranges before the call, separately for UoP (gross monthly) and B2B (net, invoiced, monthly), give a range whose bottom you are happy with, anchor on the role’s market value — and avoid disclosing your current salary.',
    answer: `**Prepare before the screening**
- Research current market data for Senior .NET in your location/remote (job boards with salary ranges like Just Join IT / No Fluff Jobs, Bulldogjob reports, people you know).
- Calculate **both**: UoP gross / month and B2B net / month (invoice amount, excl. VAT). B2B is typically ~20–30% higher to cover no paid leave/sick days, ZUS, accounting, equipment.
- Decide your **walk-away minimum** and your target.

**How to say it**
- "For this role I'm looking at **[X–Y] PLN gross on UoP** or **[A–B] PLN net + VAT on B2B**, depending on the full package and scope."
- The bottom of your range should be a number you're happy with — offers land near the bottom.
- If they ask first and you can: "What is the budget for this role?" — the ad may already have a range; aim for its upper part if you match well.

**Current salary**: you don't have to answer — "I'd rather focus on the value of this role; my expectations are [range]."

**Also clarify**: paid days off on B2B, benefits, equipment, training budget, bonus.`,
  },
  {
    id: 'rec-conditions-basics',
    category: 'Recruiter & Conditions',
    difficulty: 1,
    question: 'UoP or B2B? Notice period / start date? Remote, hybrid or office? Are you in other processes?',
    tldr: 'Have short, prepared answers: contract preference (and openness), notice period and the earliest realistic start date, work-mode preference with flexibility, and an honest "yes, I am in other processes at stage X" which creates healthy urgency.',
    answer: `**UoP or B2B**: state your preference and whether you're open to the other: "I prefer B2B, but I'm open to UoP for the right package." Know the trade-offs (stability, paid leave, ZUS, tax, flexibility).

**Notice period / start**: "My notice period is [X weeks/months]; I can start on [date]." If possible, mention you could negotiate an earlier release.

**Work mode**: "Ideally remote/hybrid [N days in the office]; I'm happy to come in for planning, workshops and onboarding." Ask how the team actually works.

**Other processes**: honest but brief: "Yes, I'm in a few processes, some at the final stage." It signals you're in demand and lets them speed up — don't name companies or invent offers.

**Current salary**: optional; steer to expectations.

**Also be ready for**: English level (prepare "tell me about yourself" in English), why you're looking, what you're looking for in the next role.`,
  },
  {
    id: 'rec-questions-to-ask',
    category: 'Recruiter & Conditions',
    difficulty: 1,
    question: 'What questions do you ask the recruiter or the team at the end?',
    tldr: 'Ask questions that show seniority and filter weak offers: team and decision-making, tech stack and code state, process (code review, CI/CD, tests), contact with the business, growth path to Tech Lead, biggest challenges, how success is measured, why the role is open, training budget, and next steps.',
    answer: `**About the team and work**
1. What does the team look like: how many people, which roles, who makes technical decisions?
2. What's the tech stack and the state of the code (legacy or a new project)?
3. What's the process: Scrum/Kanban, code review, CI/CD, tests?
4. Is there direct contact with the client or the business?

**About growth and success**
5. What does the growth path look like, e.g. towards Tech Lead?
6. What are the team's biggest challenges in the coming months?
7. How do you measure success in this role after 3 and 6 months?
8. Why is this position open (new role or replacing someone)?
9. Is there a training budget / certifications (e.g. AZ-204)?

**Closing**
10. What are the next steps and when can I expect an answer?

**Tip**: pick 3–4 per conversation, matched to who you're talking to (recruiter → process and conditions; engineers → code, deployments, on-call; manager → expectations, challenges). Ask follow-ups to their answers — it turns the interview into a conversation.`,
  },
]);
