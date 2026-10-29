---
name: hirist-search
version: 1.0.0
description: >
  Search hirist.tech, India's tech-jobs portal (sister site of iimjobs), for IT,
  engineering, cloud, DevOps, SRE, data and tech-leadership roles in Indian
  cities (Bangalore/Bengaluru, Hyderabad, Delhi NCR, Gurgaon, Pune, Mumbai,
  Chennai), remote, and a few overseas locations such as Dubai. Use when the
  user wants hirist jobs, tech jobs in India, or the full text of a hirist
  posting. Trigger phrases: hirist, hirist.tech, search hirist, tech jobs in
  India, IT jobs in Bangalore, DevOps jobs in Hyderabad, tech job portal India,
  "find director roles on hirist", look up this hirist job.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/hirist-search/cli/src/cli.ts *)
---

# hirist.tech Search Skill

Search live tech-job listings on **hirist.tech** (India) through the public JSON API its
own web app calls. No login, no API key, and **zero runtime dependencies**: it runs with
just `bun`.

## ⚠️ Personal use only

This reads hirist.tech's public job API, the same endpoints the website calls from your
browser. `robots.txt` allows the job and search pages but asks crawlers for a **10-second
delay between requests**. Each CLI call makes one request, so **space calls out, keep
volume low, and don't use it commercially or for bulk data collection.** Run it on your
own responsibility.

## When to use this skill

- Search hirist.tech for tech and tech-leadership openings by keyword, city, and recency
- Get the full description, skills, experience band and status of a hirist posting

## Commands

### Search job listings

```bash
bun run .agents/skills/hirist-search/cli/src/cli.ts search --query "<keywords>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — **required.** Job title, skill or role keywords.
- `--location <text>` / `-l <text>` — a hirist location name: `"Bangalore"`, `"Delhi NCR"`, `"Hyderabad"`, `"Pune"`, `"Mumbai"`, `"Chennai"`, `"Gurgaon/Gurugram"`, `"Noida"`, `"Remote"`, `"Anywhere in India"`, `"Dubai"`, `"Abu Dhabi"`, and about 160 more. `Bengaluru`, `Gurgaon` and `Gurugram` work as aliases. An unknown name exits 1 (`BAD_LOCATION`) rather than searching everywhere.
- `--jobage <days>` — posted within N days. hirist only supports **3, 7, 15, 30 and 90**; other values round **up** to the next window (so nothing in your window is lost), and over 90 means all postings.
- `--page <n>` — page number (1-indexed, 20 results per page).
- `--limit <n>` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/hirist-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the numeric job ID from `search` (e.g. `1679015`), or a full
`https://www.hirist.tech/j/<slug>-<id>` URL. Returns the full description, skills,
experience band, remote flag, external apply URL (when the employer uses one) and
whether the posting is still active.

## Usage examples

```bash
# DevOps leadership roles posted in the last week, anywhere
bun run .agents/skills/hirist-search/cli/src/cli.ts search -q "devops director" --jobage 7 --format table

# SRE manager roles in Bengaluru
bun run .agents/skills/hirist-search/cli/src/cli.ts search -q "SRE manager" -l "Bengaluru" --format table

# Cloud operations roles in Hyderabad, last 30 days
bun run .agents/skills/hirist-search/cli/src/cli.ts search -q "cloud operations" -l "Hyderabad" --jobage 30

# Platform engineering roles in Delhi NCR, second page
bun run .agents/skills/hirist-search/cli/src/cli.ts search -q "platform engineering" -l "Delhi NCR" --page 2 --format table

# Full details of one posting
bun run .agents/skills/hirist-search/cli/src/cli.ts detail 1679015 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

JSON search output is `{ "meta": { "count", "page", "total", "has_more" }, "results": [...] }`;
each result has `id`, `title`, `company`, `location`, `date` (`YYYY-MM-DD`), `url`, plus
`experience` (e.g. `"10-20 yrs"`) and `skills`. Missing values are `null`.

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- **Relevance-ranked, not date-ranked.** The API ignores a date sort, so a broad query
  returns older postings first-page; use `--jobage` for freshness.
- **Broad matching.** hirist matches keywords loosely: "devops director" also returns
  other director roles (product design, data governance). Read titles before ranking.
- **Location is an ID filter.** The CLI maps names to hirist's numeric location IDs from
  `cli/src/locations.ts`. A posting tagged with several cities matches any of them.
- **Company names** come as the recruiter entered them, sometimes the legal entity in
  capitals (`HEALTHEDGE TECHNOLOGIES INDIA PRIVATE LIMITED`).
- **Applying** usually needs a hirist login and happens on the site; `detail` shows an
  `apply_url` only when the employer redirects to its own ATS.
- The CLI retries 429/5xx with exponential backoff. See `url-reference.md` for endpoints.
