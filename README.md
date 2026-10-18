# memo · AI Midterm

A calm, responsive study companion built from **AI_Midterm_Complete_Question_Bank.pdf**. Russian interface, original English study material. No accounts, API keys, runtime dependencies or external fonts.

## Study features

- All **256 MCQs and 73 essays**, across six lecture sections and a clearly marked supplementary research section.
- Flashcards with honest self-assessment and spaced repetition: 10 minutes after mistakes; successful intervals of 1, 3, 7, 14 and 30 days.
- Practice with immediate feedback, explanations, references and a retry-mistakes session.
- Configurable mock exams with a persistent wall-clock timer, navigation, deferred feedback and full review. Unanswered items count as incorrect.
- Essay drafts autosave locally; compare against the original model answer and self-assess against five criteria. No automated essay grading.
- Search, topic/type/progress filters, favorites, daily goal, streak, activity and session history.
- Local progress with JSON backup/import; light/dark themes; keyboard controls; responsive mobile navigation.
- Offline use after the first successful visit via a service worker. Browser storage and cache can be cleared by the browser, so export important progress.

## Development

Use the existing checkout in `/workspace/midterm`; cloud tasks already have isolated workspaces, so a Git worktree is unnecessary.

Requires Node.js 20+ (Node.js 24 used for validation). There are no npm dependencies to install.

```sh
cd /workspace/midterm
npm test
npm run dev
```

The development server uses port **4173**, or `PORT` if set. `npm run build` produces `dist/`; `npm run preview` serves that output. Both root and `/midterm/` paths are supported by the local server. In cloud onboarding, use local HTTP requests for validation; the onboarding UI does not support web previews.

## Validation

`npm test` verifies all source IDs, section counts, option/answer structure, five-part rubrics, spaced repetition, accuracy, streaks, backup round trips and invalid imports.

With the server running and Python Playwright + Chromium installed:

```sh
python3 tests/browser_smoke.py
```

The end-to-end checks exercise practice/results/retries, exam timing and skips, flashcards, essay drafts and rubrics, search/favorites, backup restore, theme, mobile navigation and offline reload. Set `BASE_URL` to run against another origin or GitHub Pages. It uses isolated browser storage and never changes server-side data.

## Source fidelity

The original PDF is available under `public/question-bank.pdf`. To regenerate `public/bank.json`, install the system `pdftotext` tool (Poppler), then run:

```sh
python3 scripts/extract_questions.py
```

The extractor removes running headers and page footers, joins wrapped lines, and asserts every expected ID, answer, rubric and per-section count. It does not generate additional material or rewrite the original answers. Research material remains supplementary.

## GitHub Pages

The `pages.yml` workflow tests, builds and deploys on every push to `main`, and supports manual dispatch. In GitHub repository **Settings → Pages**, use **GitHub Actions** as the build source. All asset paths are relative, so the site supports the `/midterm/` project path.

No secrets are embedded in the app. Progress belongs to the current browser/device; use export/import to transfer it. Exam marks are practice results, and card/essay marks are self-assessments.
