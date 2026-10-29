# hirist.tech URL and API reference

Recorded 2026-10-29 from the live site (web build `production/24.0.1`). Update this file
when hirist changes its API; it is the map for fixing `cli/src/helpers.ts`.

## Access

- `https://www.hirist.tech/robots.txt` disallows only CMS/admin paths (`/components/`,
  `/admin/`, `/includes/`, ...) and blocks Yandex entirely. `/search/` and `/j/` are
  allowed. It sets **`Crawl-delay: 10`**.
- The API host `gladiator.hirist.tech` answers search and detail without a login or
  token. The site's HTML (`/search/<query>`) is a Next.js shell whose `__NEXT_DATA__`
  carries an **empty** `jobfeed`: results are fetched client-side from the API below, so
  the CLI calls the API rather than parsing HTML.
- Headers the web app sends and the CLI copies: `version: 2`, `Referer:
  https://www.hirist.tech/`. User-Agent is the honest `Mozilla/5.0 (compatible; hirist-cli/1.0)`.

## Search

`GET https://gladiator.hirist.tech/job/search`

| Parameter | Meaning | Notes |
|-----------|---------|-------|
| `query` | Keywords | Required for useful results; matching is broad |
| `page` | Page number | **0-indexed** (CLI `--page 1` → `page=0`) |
| `size` | Page size | Web app sends 20 |
| `loc` | Location ID | Numeric; map in `cli/src/locations.ts`. Bangalore 3, Hyderabad 4, Mumbai 2, Chennai 6, Pune 7, Delhi NCR 1, Gurgaon 37, Noida 38, Remote 132, Dubai 91, Abu Dhabi 100; groups Metros 87, Anywhere in India 88, Overseas 89 |
| `posting` | Posted within N days | Accepted values `3`, `7`, `15`, `30`, `90` (UI options); omit for all |
| `minexp` / `maxexp` | Experience band (years) | Seen in the web bundle, not used by the CLI |
| `sort` | `date` / `relevance` | **No effect** on the API in testing (2026-10-29) |

Response envelope:

```json
{ "data": [ ...jobs ], "page": "0", "limit": 20, "count": 20,
  "totalJobs": 218, "count1Year": 2847, "totalPages": 10, "hasMore": true }
```

Per-job fields the CLI reads:

| Field | Use |
|-------|-----|
| `id` (number) | Job ID → `detail` |
| `title` | Title (may carry entities/padding) |
| `companyData.companyName` | Company |
| `locations[].name` | Locations; `"Others"` is dropped |
| `createdTime` (epoch ms) | Posting date: its **UTC** calendar date matches what the site shows (1792089000000 → "Posted on 15/10/2026") |
| `min` / `max` | Experience band, years |
| `tags[].name` | Skills |
| `jobDetailUrl` | Canonical posting URL, `https://www.hirist.tech/j/<slug>-<id>` |

## Detail

`GET https://gladiator.hirist.tech/job/detail?jobcode=<id>`

Response: `{ "data": { ...job } }` with the search fields plus:

| Field | Use |
|-------|-----|
| `introText` | Full description as HTML (`<p>`, `<b>`, `<br/>`); cleaned with `visibleHtml` + `cleanHtml` |
| `jobJdContent` | Null on the postings seen |
| `applyUrl` | External ATS link, empty when applying happens on hirist |
| `workFromHome` | `1` for remote |
| `active`, `hasExpired` | Posting status |

## Discovery notes

Endpoints were read from the site's JS bundle (`/_next/static/chunks/pages/_app-*.js`):
the API base is `https://gladiator.hirist.tech` + `/job`, the search thunk calls
`GET /search` with `size: 20` and header `version: 2`, and `getJobDetails` calls `GET
/detail` with `jobcode`. The location option list (`{label, value}` pairs) is in the same
bundle next to the posting-age options.
