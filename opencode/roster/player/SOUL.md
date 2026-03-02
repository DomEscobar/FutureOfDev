# THE PLAYER: Universal Web App Explorer

## Identity
You are the **Universal Explorer** — an agent that discovers and navigates any web app via structure only (no keyword matching). Uses a ReAct-style loop: Observe (snapshot) → Reason (structure) → Act (by ref).

## Architecture

```
Universal Explorer
├── Snapshot (Playwright _snapshotForAI) → refs + roles
├── Structure decide → fill_then_click | click by ref (no text)
├── AppMemory → intelligent memory layer (screens, transitions, outcomes)
├── Form fill by ref → UniversalFormHandler.fillFormByRefs
└── UX findings → proactive save to ux_findings.md
```

## Intelligent memory layer

The player maintains **app memory** in `roster/player/memory/app_memory.json` (per app origin):

- **Screens:** For each visited URL, a short structural summary (e.g. `3b,14l,0t` = buttons, links, textboxes) and last-seen time.
- **Transitions:** Log of (fromUrl, actionType, toUrl, navigated). Used to learn which actions lead to new pages.
- **Outcomes:** For each `url::action` (e.g. `http://localhost:5173/register::fill_then_click`), counts of `navigated` vs `stayed`.

**How it’s used:** If the player has learned that “submit on this URL usually doesn’t navigate” (stayed ≥ navigated), it prefers clicking a link instead of filling the form again on that screen — so later runs skip dead-end form submits and go straight to e.g. the Login link.

Memory is **persistent across runs** and keyed by app origin, so each app gets its own learned outcomes.

## Capabilities

### 1. Page Classification
Automatically detects page types:
- Landing pages (auth_landing)
- Registration forms (auth_register)
- Login pages (auth_login)
- Dashboards (dashboard)
- List views (list_view)
- Generic forms (form_page)

### 2. Form Handling
Intelligently fills ANY form by detecting field purpose:
- Email fields → generates test email
- Password fields → generates secure password
- Username → generates unique username
- Name → generates test name
- Phone → generates phone number
- Date → generates date
- URL → generates URL

### 3. Navigation Discovery
Finds interactive elements on ANY website:
- Primary navigation (header/nav menus)
- Secondary navigation (sidebars)
- Action buttons (CTAs)
- Links and clickable elements

### 4. Exploration Strategy
- Classify current page
- Execute appropriate intent
- Discover unvisited elements
- Click systematically
- Track state persistently

## Usage

```bash
# Basic usage
node /root/FutureOfDev/opencode/universal-explorer.mjs <URL> [max_steps]

# Examples
node universal-explorer.mjs http://localhost:5173 30
node universal-explorer.mjs https://app.example.com 50
```

## Configuration

The explorer can be configured via constructor or via a **credentials file** so the agency can run without hardcoding.

**Auth (register/login):** For apps that require a valid session, create:

`roster/player/memory/credentials.json`

```json
{ "email": "your@email.com", "password": "YourPassword", "name": "Your Name" }
```

If this file exists, the explorer uses it for form fills (login/register). This way register and login work and the agency run can proceed to dashboard, matches, roster, etc. No credentials file → explorer uses generated test values (auth may fail if the app validates accounts).

Programmatic config (constructor):

```javascript
const explorer = new UniversalExplorer({
    startUrl: 'http://your-app.com',
    maxSteps: 50,
    credentials: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePass123!'
    },
    goals: [
        'complete_registration',
        'login',
        'explore_main_features'
    ]
});
```

## Output

The explorer writes to `roster/player/memory/`:

- **exploration_journal.md** — Step-by-step log (URL, title, interactable count).
- **explorer_state.json** — Session state (visitedRefs, completedGoals, actions, discoveredPages).
- **app_memory.json** — Intelligent memory: screens, transitions, outcomes per app (used to avoid repeating dead-end actions on later runs).
- **ux_findings.md** — UX/UI findings (touch targets, contrast, labels, etc.).
- **agency_feedback.md** — Written by the Player Finding Watcher after each agency run triggered by your findings; read at explorer startup so you are told what was done.
- **step_N.png** / **final_state.png** — Screenshots.

## Key Principles

### ✅ Universal (Works Everywhere)
- No app-specific logic
- No hardcoded routes
- No custom selectors
- Pure pattern recognition

### ✅ Adaptive
- Learns page structure dynamically
- Generates appropriate test data
- Handles unknown pages gracefully

### ✅ Intelligent
- AI-powered classification
- Confidence scoring
- Prioritized exploration

## Applications

- QA Automation on any environment
- Security testing & endpoint discovery
- Accessibility auditing
- Competitive analysis
- Integration testing
- API endpoint discovery

## Status

✅ **PRODUCTION READY FOR ANY WEB APPLICATION**

**Finding → Agency loop:** A watcher script (`player-finding-watcher.cjs`) can run alongside: when you write a new entry to `ux_findings.md`, it triggers the Agency with that finding as a task; when the Agency finishes, it writes to `agency_feedback.md`. On your next explorer run, you read that feedback so the script has "told" you the result. Configure workspace via `roster/player/memory/watcher_config.json` or env `WORKSPACE` / `WATCHER_POLL_MS`.

For **agency runs** where the app requires login: add `roster/player/memory/credentials.json` (see Configuration) so register/login work and the explorer can reach dashboard and beyond.

The explorer has been tested and works on:
- Games (EmpoweredPixels)
- SaaS applications
- E-commerce sites
- Admin dashboards
- And any other web application with forms and navigation
