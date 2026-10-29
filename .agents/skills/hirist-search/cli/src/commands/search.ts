import {
  apiGet,
  jobageToPosting,
  stripInvisible,
  toResult,
  writeError,
  type JobResult,
  type SearchEnvelope,
} from "../helpers.js"
import { LOCATION_ALIASES, LOCATION_IDS } from "../locations.js"

export interface SearchOpts {
  query: string
  location?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

// The web app asks for 20 per page; the API's own default is the same.
const PAGE_SIZE = 20

/**
 * Resolve a location name to hirist's numeric location ID, case-insensitively,
 * through the alias table for common spellings (Bengaluru, Gurgaon). Null when
 * hirist has no such location; the caller reports that rather than searching
 * everywhere.
 */
export function resolveLocation(name: string): number | null {
  const key = name.trim().toLowerCase()
  if (!key) return null
  const label = LOCATION_ALIASES[key] ?? name.trim()
  for (const [k, v] of Object.entries(LOCATION_IDS)) {
    if (k.toLowerCase() === label.toLowerCase()) return v
  }
  return null
}

export function buildParams(opts: SearchOpts, locId: number | null): URLSearchParams {
  const params = new URLSearchParams()
  params.set("query", opts.query)
  // The API pages from 0; the contract's --page is 1-indexed.
  params.set("page", String(opts.page - 1))
  params.set("size", String(PAGE_SIZE))
  if (locId !== null) params.set("loc", String(locId))
  if (opts.jobage !== undefined) {
    const posting = jobageToPosting(opts.jobage)
    if (posting !== null) params.set("posting", String(posting))
  }
  return params
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const header =
    "ID".padEnd(8) + " " + "TITLE".padEnd(44) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(24) + " DATE"
  const lines = rows.map((r) => {
    const title = r.title.slice(0, 44).padEnd(44)
    const company = (r.company || "—").slice(0, 26).padEnd(26)
    const loc = (r.location || "—").slice(0, 24).padEnd(24)
    return `${r.id.padEnd(8)} ${title} ${company} ${loc} ${r.date || "—"}`
  })
  return [header, "-".repeat(header.length), ...lines].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  let locId: number | null = null
  if (opts.location !== undefined) {
    locId = resolveLocation(opts.location)
    if (locId === null) {
      writeError(
        `hirist.tech has no location "${opts.location}" - use a city it lists, e.g. "Bangalore", "Delhi NCR", "Hyderabad", "Pune", "Remote", or "Anywhere in India"`,
        "BAD_LOCATION",
      )
      return 1
    }
  }
  try {
    const body = await apiGet<SearchEnvelope>("/search", buildParams(opts, locId))
    let rows = stripInvisible((body?.data ?? []).map(toResult))
    if (opts.limit !== undefined) rows = rows.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        rows
          .map(
            (r) =>
              `${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.date || "—"}` +
              `${r.experience ? ` · ${r.experience}` : ""}\n  id: ${r.id}\n  ${r.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: rows.length,
              page: opts.page,
              total: body?.totalJobs ?? null,
              has_more: body?.hasMore ?? null,
            },
            results: rows,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
