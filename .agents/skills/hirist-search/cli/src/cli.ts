#!/usr/bin/env bun
// Self-contained CLI for searching tech jobs on hirist.tech (India) through the
// public JSON API its web app uses. No external CLI framework and zero runtime
// dependencies, so it runs anywhere `bun` is available.
//
// Personal use only. hirist.tech's robots.txt asks for a 10-second crawl delay;
// each invocation makes one request, so space calls out and keep volume low.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `hirist-cli — search tech jobs on hirist.tech (India)

USAGE
  bun run src/cli.ts search --query "<keywords>" [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (job title, skill, or role). REQUIRED.
  --location, -l <text>   A hirist location: "Bangalore", "Delhi NCR", "Hyderabad", "Pune",
                          "Mumbai", "Chennai", "Remote", "Anywhere in India", "Dubai", ...
                          Bengaluru/Gurgaon/Gurugram are accepted as aliases.
  --jobage <days>         Posted within N days. hirist supports 3, 7, 15, 30 and 90 days;
                          other values round up to the next one (over 90 = all postings).
  --page <n>              1-indexed page (20 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "devops director" --jobage 7 --format table
  bun run src/cli.ts search -q "SRE manager" -l "Bangalore" --format table
  bun run src/cli.ts search -q "cloud operations" -l "Hyderabad" --jobage 30
  bun run src/cli.ts detail 1679015 --format plain

Personal use only — hirist.tech asks for a 10-second crawl delay; keep volume low.
`

// Long-form flag names each command accepts (parseFlags resolves the short
// aliases q/l/n first). Unknown flags are rejected, never silently dropped: a
// discarded filter changes what the search returns with no error.
const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function fail(error: string, code: string): number {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
  return 1
}

/** Whole numbers >= 1 only, matching the other portal CLIs (Number(), not parseInt(), so "0.5" is rejected). */
function intFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  return Number.isInteger(val) && val >= 1 ? val : null
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      return fail(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
        "UNKNOWN_FLAG",
      )
    }
  }

  if (cmd === "search") {
    if (typeof flags.query !== "string" || !flags.query.trim()) {
      return fail('the --query/-q flag is required and needs keywords (e.g. -q "devops director")', "NO_QUERY")
    }
    if (flags.location !== undefined && (typeof flags.location !== "string" || !flags.location.trim())) {
      return fail("--location requires a non-empty value", "BAD_ARG")
    }
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "table", "plain"].includes(fmt)) {
      return fail(`--format must be one of json|table|plain, got "${fmt}"`, "BAD_ARG")
    }
    const nums: Record<string, number | undefined> = {}
    for (const name of ["jobage", "page", "limit"]) {
      if (flags[name] === undefined) continue
      const v = intFlag(name, flags[name])
      if (v === null) return fail(`--${name} must be a whole number of at least 1, got "${flags[name]}"`, "BAD_ARG")
      nums[name] = v
    }
    const opts: SearchOpts = {
      query: flags.query.trim(),
      location: typeof flags.location === "string" ? flags.location : undefined,
      jobage: nums.jobage,
      page: nums.page ?? 1,
      limit: nums.limit,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) return fail("detail requires an <id|url>", "NO_ID")
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "plain"].includes(fmt)) return fail(`--format must be one of json|plain, got "${fmt}"`, "BAD_ARG")
    const opts: DetailOpts = { id, format: fmt as DetailOpts["format"] }
    return runDetail(opts)
  }

  return fail(`Unknown command "${cmd}"`, "BAD_CMD")
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n",
    )
    process.exit(1)
  })
