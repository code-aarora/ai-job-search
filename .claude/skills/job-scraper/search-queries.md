# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Danish demos and any skill you add with `/add-portal` are included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary:
- **linkedin.com/jobs** - main source for Director/Head-level roles in UAE, India, and Europe; covered by the `linkedin-search` CLI
- **bayt.com** - largest Gulf job board (WebSearch fallback, no CLI yet; scaffold with `/add-portal`)
- **gulftalent.com** - senior Gulf roles (WebSearch fallback)
- **naukrigulf.com** - Gulf roles, strong for Indian applicants (WebSearch fallback)
- **naukri.com** - India (WebSearch fallback)
- FreeHire via the `freehire-search` CLI

Danish demo portals stay **disabled** (not this candidate's market).

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies

**Query language:** English only. Hindi is declared in the Languages table but these markets post senior tech roles in English.

## Query Categories

Combine each query with a location term: "Abu Dhabi", "Dubai", "UAE", "India" (Bengaluru, Hyderabad, Pune, Gurugram), "Europe" / specific countries, or "remote".

### Priority 1: Reliability engineering leadership (SRE / Platform)

Strongest and most desired direction.

```
site:linkedin.com/jobs "Director of Site Reliability Engineering" UAE
site:linkedin.com/jobs "Head of SRE" OR "Head of Site Reliability" Dubai OR "Abu Dhabi"
site:linkedin.com/jobs "Head of Platform Engineering" OR "Director of Platform Engineering" UAE
site:bayt.com "Head of SRE" OR "SRE Manager" OR "Platform Engineering Manager"
site:gulftalent.com "Site Reliability" Director OR Head
site:linkedin.com/jobs "Director SRE" remote
site:naukri.com "Director - Site Reliability Engineering" OR "Head of SRE"
site:hirist.tech/j "Director" "Site Reliability" OR SRE OR "Platform Engineering"
```

### Priority 2: Technology and cloud operations leadership (TechOps / CloudOps / DevOps)

Domain expertise: operations, ITIL, regulated environments.

```
site:linkedin.com/jobs "Head of TechOps" OR "Head of Technical Operations" UAE
site:linkedin.com/jobs "Director of Cloud Operations" OR "Head of Cloud Operations" Dubai OR "Abu Dhabi"
site:linkedin.com/jobs "Head of DevOps" OR "Director of DevOps" UAE OR remote
site:bayt.com "Head of IT Operations" OR "Head of Infrastructure" Kubernetes
site:gulftalent.com "Head of DevOps" OR "Head of Infrastructure"
site:hirist.tech/j "DevOps Director" OR "Head of DevOps" OR "Head of Cloud Operations"
site:linkedin.com/jobs "Head of Infrastructure" ArgoCD OR Terraform Europe "visa sponsorship"
```

### Priority 3: Adjacent leadership roles

Roles the profile supports as a pivot.

```
site:linkedin.com/jobs "Head of Service Delivery" cloud UAE
site:linkedin.com/jobs "VP Infrastructure" OR "VP Engineering Operations" SaaS
site:linkedin.com/jobs "Technical Operations Director" gaming OR lottery OR fintech
site:linkedin.com/jobs "Technology Resilience" OR "Operational Resilience" Head bank UAE
site:linkedin.com/jobs "Technical Program Director" cloud migration
```

### Priority 4: Broader net (skill-led)

```
site:linkedin.com/jobs "SRE" "incident management" director UAE
site:linkedin.com/jobs Kubernetes Terraform "CI/CD" "Head of" Dubai
site:bayt.com "regulatory" "IT governance" head cloud
site:linkedin.com/jobs "reliability" "regulatory governance" director Europe
```

## Location Filter

- **Ideal:** Abu Dhabi, Dubai, remote
- **Acceptable:** India (Bengaluru, Hyderabad, Pune, Gurugram, Mumbai, any major city; no sponsorship needed)
- **Conditional:** Europe - only with employer visa sponsorship / relocation support
- **Borderline (flag):** other GCC (Riyadh, Doha, etc.), US/UK without stated sponsorship
- **Exclude:** roles reserved for UAE nationals (Emiratisation)

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
