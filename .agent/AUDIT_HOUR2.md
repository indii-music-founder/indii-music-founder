# Hour 2 Audit — Cold-Start Journey

**Run:** 2026-04-26T00:40:33.938Z
**Base URL:** http://localhost:4243

| Module | Verdict | Console errors | Network failures | Notes |
|--------|---------|----------------|------------------|-------|
| auth/landing | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/
Call log:
  - navigating to "http://localhost:4243/", waiting until "domcontentloaded"
 |
| onboarding | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/onboarding
Call log:
  - navigating to "http://localhost:4243/onboarding", waiting until "domcontentloaded"
 |
| dashboard | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/dashboard
Call log:
  - navigating to "http://localhost:4243/dashboard", waiting until "domcontentloaded"
 |
| creative | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/creative
Call log:
  - navigating to "http://localhost:4243/creative", waiting until "domcontentloaded"
 |
| video | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/video
Call log:
  - navigating to "http://localhost:4243/video", waiting until "domcontentloaded"
 |
| agent | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/agent
Call log:
  - navigating to "http://localhost:4243/agent", waiting until "domcontentloaded"
 |
| distribution | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/distribution
Call log:
  - navigating to "http://localhost:4243/distribution", waiting until "domcontentloaded"
 |
| finance | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/finance
Call log:
  - navigating to "http://localhost:4243/finance", waiting until "domcontentloaded"
 |
| publishing | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/publishing
Call log:
  - navigating to "http://localhost:4243/publishing", waiting until "domcontentloaded"
 |
| marketing | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/marketing
Call log:
  - navigating to "http://localhost:4243/marketing", waiting until "domcontentloaded"
 |
| social | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/social
Call log:
  - navigating to "http://localhost:4243/social", waiting until "domcontentloaded"
 |
| settings | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/settings
Call log:
  - navigating to "http://localhost:4243/settings", waiting until "domcontentloaded"
 |
| files | RED | 0 | 0 | navigation/load error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4243/files
Call log:
  - navigating to "http://localhost:4243/files", waiting until "domcontentloaded"
 |

## Screenshots
All in `.agent/screenshots/`. Total: 13 pre-action shots.