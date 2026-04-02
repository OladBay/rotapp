# Rotapp — Project Knowledge Base

> Residential children's care rota management web app  
> Last updated: April 2026 · Version: React + Vite migration in progress

---

## What Is Rotapp

Rotapp replaces Excel spreadsheets and printed paper rotas used by managers in residential children's homes. It is a rules-based workforce scheduler with compliance guardrails built specifically for regulated children's care settings.

The core insight: rota building in residential care is uniquely complex due to legal staffing ratios, sleep-in designations, mixed permanent/relief/agency teams, and last-minute changes. Excel breaks under all of that. Rotapp is built for it.

---

## Current Build Status

**React + Vite migration underway.** Previous v2 HTML/CSS/JS prototype has been rebuilt as a proper React application.

### Pages Built

| Page      | Status      | Notes                                                                                            |
| --------- | ----------- | ------------------------------------------------------------------------------------------------ | --- | ----- | ----------- | ------------------------------------------------------------------------- |
| Login     | ✅ Complete | Role-based redirect — managers → /dashboard, carers → /calendar                                  |
| Signup    | ✅ Complete | 2-step flow, picks home and role, lands on pending screen                                        |
| Dashboard | ✅ Complete | OL/Admin sees all homes with stats, Manager sees own home only                                   |
| Rota      | ✅ Complete | Week/year view, navigation, compliance strip, gap detection, generate modal (week + month scope) |     | Staff | ✅ Complete | Tabs: all/active/off/pending/relief/leave, approve/decline, profile modal |
| Calendar  | ✅ Complete | Carer personal shift view, shift detail modal, cancel flow                                       |
| NotFound  | ✅ Complete | 404 page                                                                                         |

### Components Built

| Component      | Status      | Notes                                                          |
| -------------- | ----------- | -------------------------------------------------------------- |
| Navbar         | ✅ Complete | Role-based links, logout, Font Awesome icons                   |
| ProtectedRoute | ✅ Complete | Role-based route protection                                    |
| GenerateModal  | ✅ Complete | 3-step: availability input → generation log → review & confirm |

### Utilities Built

| File             | Purpose                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| AuthContext.jsx  | Login, logout, switchRole, revertRole                                       |
| rotaGenerator.js | Local constraint-based rota generator                                       |
| dateUtils.js     | Week/month/year date helpers — includes getYearMonths, getMonthWeeks        |
| rotaGenerator.js | Constraint-based generator — single week and full month (generateMonthRota) |
| icons.js         | Font Awesome library registration                                           |

### Data Files (Mock — no backend yet)

| File            | Contents                                      |
| --------------- | --------------------------------------------- |
| mockUsers.js    | 13 users across all roles                     |
| mockHomes.js    | 5 homes with stats                            |
| mockRota.js     | Staff list and rota data for Meadowview House |
| mockCalendar.js | Shift data per staff member                   |
| mockLeave.js    | Absence dates per staff member                |

### What Is Working

- Auth and role-based access throughout
- Rota grid with early/late/sleep-in/on-call rows
- Compliance detection — gaps, sleep-ins, female/driver soft rules
- Year view (12 mini calendars) with health-coded days — green (compliant), yellow (soft breach), red (gap), grey (not planned)
- Clicking a month in year view jumps to that month's first week
- Year view prev/next navigates by year, with a Today button
- Week navigation unchanged — prev/next week, jump to date
- Generate modal with week or full-month scope toggle
- Month generation runs all weeks in one operation, review screen groups violations by week in a collapsible accordion
- Staff management — approve/decline pending staff
- Leave and absence tab (permanent staff only — seniors and RCWs)
- Carer calendar with shift cancel flow
- Font Awesome icons throughout

### What Needs To Be Built (In Order)

1. **localStorage persistence** — data survives page refresh
2. **Click-to-edit rota cells** — swap staff in and out directly on the grid
3. **Relief staff availability submission** — relief staff mark their available days, feeds into generate modal
4. **Gap filling flow** — manager sees gap, manually assigns or SMS broadcasts to eligible staff
5. **Operational Lead role switch** — step into Manager/Deputy for a session, reverts on logout
6. **Empty states and onboarding hints** — new manager knows what to do on first login
7. **Mobile layout** — rota grid works on phone
8. **24hr stretch warning** — detect and flag dangerous stretches with override log
9. **Publish rota flow** — lock week and notify staff
10. **Styling pass** — full visual polish

---

## Tech Stack

| Layer             | Choice                           | Notes                                              |
| ----------------- | -------------------------------- | -------------------------------------------------- |
| Framework         | React + Vite                     | Scaffolded and running                             |
| Styling           | Inline styles (per component)    | CSS Modules planned for styling pass               |
| State             | useState + useContext            | No Redux needed yet                                |
| Icons             | Font Awesome (react-fontawesome) | All icons use FA — no emoji or text symbols        |
| Data storage      | localStorage (now)               | Supabase free tier planned when backend added      |
| Auth              | Mock (now)                       | Supabase Auth planned                              |
| Hosting           | Netlify (planned)                | Free tier                                          |
| Backend (future)  | TBD                              | Django originally planned — revisit when ready     |
| Database (future) | TBD                              | PostgreSQL originally planned — revisit when ready |

**Cost constraint:** Nothing that costs money while building. All tools must have a free tier sufficient for development.

**Fonts:** DM Sans (body) + Syne (headings/numbers) + DM Mono (times/codes)

**Repo:** github.com/OladBay/rotapp  
**Local path:** ~/Projects/rotapp  
**Developer:** Emmanuel Oladokun (oladbay@gmail.com), Mac, VS Code

---

## The Homes Structure

One company operates multiple residential children's homes. Each home:

- Is self-contained with its own permanent staff team
- Manages its own rota independently
- Has its own Manager, Deputy Manager, Senior Carer(s), and RCWs
- Uses its own shift times (configured per home)

Homes share resources:

- **Relief/Bank staff** are cross-home (company-wide pool)
- **Permanent staff** can pick up overtime shifts at other homes (dual approval required)
- **Operational Leads** have read-only visibility across all homes

Current mock homes: Meadowview House, Riverside Home, Oakfield, Springdale, Birchwood

---

## Role Hierarchy

| Role             | Scope      | Rota Access         | Can Edit Rota       | On-Call Eligible |
| ---------------- | ---------- | ------------------- | ------------------- | ---------------- |
| Super Admin      | All homes  | Full                | ✓ Full              | ✗                |
| Operational Lead | All homes  | Read-only dashboard | ✗ (unless switched) | ✗                |
| Manager          | Own home   | Full                | ✓ Full              | ✓ Yes            |
| Deputy Manager   | Own home   | Full                | ✓ Full              | ✓ Yes            |
| Senior Carer     | Own home   | Full view           | ✓ Limited           | ✓ Rare           |
| RCW (permanent)  | Own home   | Own shifts only     | ✗                   | ✗                |
| Relief / Bank    | Cross-home | Own shifts only     | ✗                   | ✗                |
| Agency           | External   | No app login yet    | ✗                   | ✗                |

### What each role sees after login

- **Super Admin / Operational Lead** — summary dashboard across all homes, drill into any home
- **Manager / Deputy** — land on their home's rota (current week), see gaps, generate, publish
- **Senior Carer** — land on their home's rota, can see gaps, can suggest fills, cannot publish
- **RCW / Relief / Bank** — land on personal calendar, own shifts only, no gaps visible
- **Agency** — no login for now, managed by manager

### Operational Lead role switch

- OL can temporarily switch into Manager or Deputy role for any home
- Full manager access for that session only
- Reverts automatically on logout
- Does not permanently assign them to that home

---

## Staff Types

### Permanent Staff (RCWs, Senior Carers)

- Contracted hours (typically 37hrs/week)
- Assigned to one home
- Manager builds their rota — they do NOT submit availability upfront
- Can request swaps, flag unavailability, cancel shifts after rota is published
- Can request overtime at other homes (dual manager approval required)

### Relief / Bank Staff

- Not contracted to any single home
- Cross-home availability — shared pool across all homes
- Submit their own availability each week
- Manager pulls from available pool to fill gaps
- May gravitate toward one home through habit but are not assigned to one
- First port of call after permanent staff gaps appear

### Agency Staff

- Fully external, last resort only
- Same availability submission model as relief
- Used only when relief cannot fill a gap
- Priority order: Permanent overtime → Relief → Agency
- No app login currently — managed by manager

---

## Staff Management Flows

### New staff joining

1. Staff signs up at /signup
2. Picks home and role (Carer or Relief only — cannot self-assign Manager/Senior)
3. Account created as PENDING
4. Manager sees pending badge on Staff page
5. Manager approves → staff gets email confirmation and access
6. Manager declines → account removed

### Staff moving homes

1. Manager A initiates move from their Staff page
2. Manager B of receiving home accepts
3. Staff home updates — they appear in new home's pool
4. Old home no longer sees them

### Leave and absence

- Managed by manager on Staff page → Leave & Absence tab
- Permanent staff only (Seniors and RCWs) — not relief
- Manager marks specific dates as off
- Absence dates auto-populate as unavailable in the rota generator
- Reasons: annual leave, sick, any absence

---

## Shift Structure

### The Two Shifts

Every day has exactly two shifts:

| Shift | Description                                         |
| ----- | --------------------------------------------------- |
| Early | Morning shift — times configured per home           |
| Late  | Afternoon/evening shift — times configured per home |

### Sleep-in (Critical Logic)

Sleep-in is **NOT a separate shift**. It is a **tag on 2 late shift staff**.

```
Late Shift = [Staff A 💤, Staff B 💤, Staff C, Staff D]
              ↑ sleep-in   ↑ sleep-in
```

- Always exactly 2 sleep-ins per night (hard rule)
- Sleep-in staff stay on site overnight after their late shift ends
- Ideally at least one permanent staff member on sleep-in (soft rule)
- Staff can request someone else to cover their sleep-in
- Sleep-in swap: staff requests, manager approves, payment tracked to covering staff

### Waking Night

- Situational — activated only when a home's current circumstances require it
- Not standard — manager activates per home when needed
- Adds a third daily slot to the rota view for that home

### Shift Times (Configured Per Home)

Shift times vary by home. Two common patterns:

**Pattern A:**

- Early: 08:00–14:30
- Late (Mon–Thu): 14:00–23:00
- Late (Fri–Sat): 14:00–23:30

**Pattern B:**

- Early: 07:00–14:30
- Late (Mon–Thu): 14:00–23:00
- Late (Fri–Sat): 14:00–23:30

Each home's shift times are configured in home settings and applied to all rota generation for that home.

---

## The Rules Engine

### Hard Rules — Block generation, must be resolved

| Rule                         | Logic                                            |
| ---------------------------- | ------------------------------------------------ |
| Minimum 3 staff per shift    | Managers and Deputies do NOT count toward this 3 |
| Always 2 sleep-ins per night | Must be filled every night                       |
| Relief before agency         | Never assign agency if relief is available       |

### Soft Rules — Flag with warning, allow override

| Rule                                | Behaviour                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------- |
| 1 female staff per shift            | Flag if missing, do not block                                               |
| 1 driver per shift (early and late) | Flag if missing, do not block. Managers can borrow drivers from other homes |
| 1 permanent staff on shift          | Flag if missing, do not block                                               |
| 1 permanent staff on sleep-in       | Flag if missing, do not block                                               |
| Sleep-in staff work next day early  | Suggest, do not enforce                                                     |

### Compliance Warnings — Loud alert, require manager confirmation

| Situation              | Behaviour                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 24hr+ stretch detected | Early + Late + Sleep-in + next day Early. Show warning modal, require manager confirm, log override with timestamp and manager name for audit |

### The 24hr Stretch Pattern

```
Monday:   Early (07:00–14:30)
Monday:   Late  (14:00–23:00) + Sleep-in tag
Tuesday:  Early (07:00–14:30)
= ~24hrs continuous duty
```

Not a hard block — happens in real life. Must be:

1. Flagged loudly with a warning modal
2. Confirmed by a manager
3. Logged with timestamp for Ofsted/CQC audit trail

---

## Rota Generation Logic

### How it works (permanent staff model)

Rotapp is built for a **fixed-staff model** — not an agency model.

1. Manager opens the week for generation
2. Permanent staff are pre-populated based on their usual patterns
3. Manager adjusts for known absences (already marked on leave tab — auto-populate as Off)
4. Gaps remaining get filled from the relief pool based on who has marked themselves available
5. Generate button optimises placement and checks all constraints
6. Manager reviews violations and override decisions
7. Manager applies rota or regenerates

### Relief staff availability (separate flow)

- Relief staff log in and mark their available days for the week from their calendar
- This feeds directly into the generate modal as available relief pool
- Manager does not manually input availability for relief — they submit it themselves

### Generate modal flow (3 steps)

1. **Availability** — permanent staff shown with absence dates pre-filled, day toggles to hide columns, instructions panel via ℹ icon
2. **Generating** — live log showing constraint checks and assignment decisions
3. **Review** — stats, hard violations, soft rule flags, mini preview table, override checkbox for hard violations, apply or regenerate

---

## On-Call System

On-call runs **parallel to the rota** — it is not a shift.

- Each day has 2–3 people designated on-call
- On-call pool: Manager, Deputy Manager, Senior Carer (rare)
- Any staff member on shift can phone on-call for incidents or decisions above their level
- On-call person may or may not need to physically attend
- Displayed as a row at the bottom of the rota grid, showing daily on-call for the whole week

---

## Gap Filling Flow (To Be Built)

When a gap appears after the rota is published:

1. Staff cancels a shift → gap flagged on rota grid
2. Manager sees gap highlighted with GAP tag
3. Manager decides:
   - **Manual assign** — picks a staff member directly from eligible pool
   - **SMS broadcast** — sends nudge to all eligible staff (permanent at other homes wanting overtime, relief pool, agency as last resort)
4. Manager picks who fills it from responses
5. Gap resolved — staff notified

Carers never see gaps. Only Managers, Deputies, Operational Leads, and Senior Carers see gap indicators.

---

## Overtime Logic (Cross-Home)

When a permanent staff member works at another home:

```
Staff requests overtime at Home B
         ↓
Home A manager approves release
         ↓
Home B manager approves incoming
         ↓
Overtime confirmed — appears on both home rotas
```

- Both approvals required
- Either manager rejecting cancels the request
- Full audit trail maintained

---

## UI Colour System

| Shift Type       | Colour                | Usage                               |
| ---------------- | --------------------- | ----------------------------------- |
| Early            | Green tint (#2a7f62)  | Morning shifts                      |
| Late             | Purple tint (#7a4fa8) | Afternoon/evening shifts            |
| Sleep-in tag     | Amber (#c4883a)       | Tagged on 2 late shift staff        |
| On-call          | Blue (#3a8ac4)        | On-call row                         |
| Gap / violation  | Red (#e85c3d)         | Understaffed cells, hard violations |
| Soft rule flag   | Amber (#c4883a)       | Missing female, driver warnings     |
| Compliance OK    | Green (#2ecc8a)       | All rules satisfied                 |
| Accent / primary | Blue (#6c8fff)        | Buttons, active states, links       |

Dark mode is default. Light mode available via toggle.

---

## Rota View Structure

### Week view

- Grid: shift label column + 7 day columns
- Rows: Early, Late, On-call
- Each cell shows staff chips with name and role code
- Sleep-in tagged with 💤 on late chips
- GAP tag shown on understaffed cells (managers/seniors only)
- Violation dot on day headers where rules are broken
- Day toggles: checkboxes in generate modal to hide days from availability table

### Year view

- 4-column grid of 12 mini month calendars
- Each day cell colour-coded by rota health: green (compliant), yellow (soft breach), red (gap), muted grey (not planned)
- Each month shows a summary chip — gaps count, breach count, or "All clear"
- Click any month → jumps to first week of that month in week view
- Click any day → jumps to that day's week in week view
- Prev/next arrows navigate by year, Today button snaps back to current year

### Navigation

- Previous/next week or month arrows (Font Awesome chevrons)
- Jump to date picker
- Week/month view toggle

---

## Rota Footer Panels

Each rota view shows at the bottom of the grid:

1. **On-Call** — who is on-call each day of the week with their role

Planned additions: 2. **Sleep-in Assignments** — SI 1 and SI 2 per night 3. **Shift Leaders** — early lead and late lead per day

---

## Compliance and Audit

- All hard rule violations block rota application (unless manager override with checkbox)
- All soft rule violations surface as flags on compliance strip
- 24hr stretch overrides logged with: manager name, timestamp, affected staff, date
- Audit trail designed to satisfy Ofsted and CQC inspection requirements
- Planned: exportable compliance report per home per week

---

## Known Edge Cases To Handle

| Scenario                                       | How to handle                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| No permanent staff available for sleep-in      | Assign relief, flag if unfilled                                     |
| Staff hospital emergency / last-minute absence | Emergency cover workflow, notify on-call                            |
| Staff requesting late-only shifts              | Manager sets preference on staff profile                            |
| Sleep-in swap between staff                    | Staff requests, manager approves, payment tracked to covering staff |
| Waking night needed                            | Manager activates per home, adds as third daily slot                |
| Permanent staff overtime at another home       | Dual approval workflow                                              |
| Agency required                                | Only after relief exhausted, flagged prominently                    |
| No drivers available at a home                 | Manager can borrow driver from another home                         |

---

## What Will Change (Expected Evolution)

- Exact rules around sleep-in frequency per staff member
- Whether Senior Carers get on-call more frequently
- Payroll and overtime calculation integration
- Mobile app version
- Reporting and export formats
- Whether agency management is fully in-app or partially external
- Backend choice (Django vs alternatives) — revisit when frontend is stable
- Real authentication (Supabase planned)
- Real database (Supabase PostgreSQL planned)

**Working principle:** Everything is a starting point. Build iteratively, adjust as real-world feedback comes in.

---

## Working Style

- Build first, adjust later — working prototypes over lengthy planning
- Step by step — one file, one feature at a time
- Flag important architectural decisions before building
- Everything is subject to change as understanding improves
- Font Awesome for all icons — no emoji or text symbol substitutes
- Prettier installed for auto-formatting on save
