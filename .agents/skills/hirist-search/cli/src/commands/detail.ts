import { apiGet, stripInvisible, toDetail, writeError, type HiristJob } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

const HIRIST_HOST = /(^|\.)hirist\.(tech|com)$/i

/**
 * Accept a numeric job ID or a hirist.tech job URL (`/j/<slug>-<id>`, with or
 * without scheme). A URL on any other host is rejected: host and path go
 * through real URL parsing, so look-alike hosts (hirist.tech.evil.io) and
 * userinfo tricks (hirist.tech@evil.io) fall on the reject side.
 */
export function normalizeId(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d{4,}$/.test(trimmed)) return trimmed
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (hasScheme || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
    let parsed: URL
    try {
      parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    } catch {
      return null
    }
    if (!HIRIST_HOST.test(parsed.hostname)) return null
    const m = parsed.pathname.match(/^\/j\/(?:[^/]*-)?(\d{4,})\/?$/)
    return m ? m[1] : null
  }
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a hirist job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const body = await apiGet<{ data?: HiristJob | null }>("/detail", new URLSearchParams({ jobcode: id }))
    if (!body?.data || !body.data.id) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = stripInvisible(toDetail(body.data))

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"} · ${job.date || "—"}`,
        "",
        job.experience ? `Experience: ${job.experience}` : "",
        job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
        job.remote ? "Remote: yes" : "",
        `Status: ${job.is_active ? "ACTIVE" : "CLOSED / EXPIRED"}`,
        job.apply_url ? `Apply: ${job.apply_url}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0))
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
