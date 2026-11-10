# 🎯 Rekru: Interview Prep Flashcards

A lightweight web app for preparing for software engineering interviews, from fundamentals to senior level.
It is plain HTML, CSS and JavaScript: no build step, no backend and no accounts.

**Live:** https://seler09.github.io/interview-prep/

## Features
- **Study mode**: flashcards with spaced repetition (Leitner system). Questions you struggle with come back sooner, and each session ends with a summary.
- **In-depth answers**: every question has a one-sentence **TL;DR** to open with, a detailed answer with code examples, and **likely follow-up questions** with expandable answers.
- **Browse**: all questions with full-text search.
- **Progress**: mastery percentage, per-category stats, daily activity and streak.
- **No accounts**: progress is saved automatically in the browser's `localStorage`, so every visitor keeps their own progress on their own device.
- **Reset**: clear all progress, or only the questions matching the current filters. You can also export and import progress as JSON.
- **Tracks and filters**: Fundamentals / Senior, categories, difficulty.
- **Mobile-first**: bottom navigation and thumb-friendly rating buttons, light and dark themes, keyboard shortcuts (`Space` to reveal, `1` `2` `3` to rate).

## Question bank
108 questions in 20 categories:

| Track | Categories |
|---|---|
| Fundamentals (27) | JavaScript, HTML & CSS, Git, Databases, Programming Fundamentals, Networking & HTTP, Behavioral |
| Senior (81) | System Design, Distributed Systems, Databases, Architecture, JS / TS / Node, Frontend, Concurrency, Security, Testing & Quality, DevOps & Observability, Performance, Algorithms & Live Coding, Leadership & Behavioral |

## Project structure
```
index.html                     page markup
style.css                      styles (light/dark, responsive)
app.js                         app logic, mini-markdown renderer, localStorage persistence
questions.js                   fundamentals + the addQuestions() helper
questions-senior-design.js     System Design, Distributed Systems
questions-senior-data-arch.js  Databases (Senior), Architecture
questions-senior-stack.js      JS/TS/Node, Frontend, Concurrency
questions-senior-ops-lead.js   Security, Testing, DevOps, Performance, Algorithms, Leadership
```

## Adding questions
Add an object to one of the `questions*.js` files:

```js
{
  id: 'unique-id',            // progress is stored by id, so never change it later
  category: 'System Design',  // filters are generated automatically
  difficulty: 2,              // 1 = easy, 2 = medium, 3 = hard
  question: 'Design a rate limiter.',
  tldr: 'One-sentence summary to open your answer with.',
  answer: `Full answer in mini-markdown: **bold**, \`code\`, lists, tables and code blocks.`,
  followUps: [
    'A follow-up question without an answer',
    { q: 'A follow-up question', a: 'Its answer (mini-markdown)' },
  ],
}
```
Inside template strings, escape backticks as `` \` `` and `${` as `\${`.

## Run locally
Open `index.html` in a browser. No server needed.

## Deploy (GitHub Pages)
Every push to `main` is published automatically (Settings → Pages → Deploy from a branch → `main` / root).

**Releasing a new version:** bump the `?v=` number on the `<link>` and `<script>` tags in `index.html` **and** the `version` in `version.json` to the same value.
- `?v=` prevents browsers from mixing cached old CSS/JS with a new page.
- On start (and when the tab becomes visible again) the app fetches `version.json` without cache; if it differs from its own version it reloads once with a cache-busting URL, so phones pick up updates without a manual hard refresh.
- The current version is shown at the bottom of the Progress tab.
