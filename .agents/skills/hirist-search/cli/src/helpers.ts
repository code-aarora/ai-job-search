// Data source: hirist.tech's public JSON API at gladiator.hirist.tech, the same
// endpoints the hirist.tech web app calls from the browser. Search and job
// detail are readable without logging in. robots.txt on www.hirist.tech allows
// the job and search pages and asks for a 10-second crawl delay, so keep calls
// sparse (one search or detail per invocation; /scrape should not loop fast).

export const API_BASE = "https://gladiator.hirist.tech/job"
export const SITE_BASE = "https://www.hirist.tech"

// The honest tool-naming User-Agent every shipped portal CLI uses.
const UA = "Mozilla/5.0 (compatible; hirist-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

// The most apiGet sleeps across all retries of one request. Its own backoff
// schedule (500ms doubling to 8s, six retries) stays under it; a Retry-After
// that would push past it fails the request at once instead, so an outage still
// degrades this source quickly rather than outlasting the caller's tool timeout.
const RETRY_BUDGET_MS = 30_000

/**
 * The wait a 429/503 asks for via `Retry-After`, in ms, or null when absent or
 * unreadable. Accepts both RFC 9110 forms: delta-seconds and an HTTP-date.
 */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null
  const value = header.trim()
  if (/^\d+$/.test(value)) return Number(value) * 1000
  const date = Date.parse(value)
  if (Number.isNaN(date)) return null
  return Math.max(date - now, 0)
}

/**
 * GET JSON from the hirist API. Retries 429/5xx with exponential backoff and
 * jitter (six retries, honouring Retry-After within RETRY_BUDGET_MS); returns
 * null on a 404. A connection failure fails fast with a clear message.
 */
export async function apiGet<T>(path: string, params: URLSearchParams): Promise<T | null> {
  const url = `${API_BASE}${path}?${params.toString()}`
  const maxRetries = 6
  let delay = 500
  let waited = 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          // The web app sends both; the search endpoint answers in the v2 shape with it.
          version: "2",
          Referer: `${SITE_BASE}/`,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      throw new Error(`could not reach the hirist API (${e instanceof Error ? e.message : String(e)})`)
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`hirist API request failed: ${response.status} ${response.statusText}`)
      }
      const backoff = delay + Math.floor(Math.random() * 500)
      const retryAfter = retryAfterMs(response.headers.get("Retry-After"))
      const wait = Math.max(backoff, retryAfter ?? 0)
      if (waited + wait > RETRY_BUDGET_MS) {
        throw new Error(
          `hirist API request failed: ${response.status} ${response.statusText}; ` +
            `the server asked to retry in ${Math.ceil(wait / 1000)}s, past this CLI's ${RETRY_BUDGET_MS / 1000}s retry budget`,
        )
      }
      await sleep(wait)
      waited += wait
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`hirist API request failed: ${response.status} ${response.statusText}`)
    const body = (await response.json().catch(() => null)) as T | null
    if (!body) throw new Error("hirist API returned an unparseable response body")
    return body
  }
  throw new Error("hirist API request failed after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** The fields this CLI reads from a hirist job (the wire shape carries far more). */
export interface HiristJob {
  id: number
  title?: string | null
  jobDetailUrl?: string | null
  createdTime?: number | null
  min?: number | null
  max?: number | null
  locations?: { id: number; name: string }[] | null
  companyData?: { companyName?: string | null } | null
  tags?: { name: string }[] | null
  applyUrl?: string | null
  workFromHome?: number | null
  introText?: string | null
  hasExpired?: boolean | null
  active?: number | null
}

/** The search endpoint's envelope. `page` comes back as a string. */
export interface SearchEnvelope {
  data?: HiristJob[] | null
  page?: string | number
  count?: number
  totalJobs?: number
  totalPages?: number
  hasMore?: boolean
}

/** A search result in the portal-skill contract shape; missing values are null. */
export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  experience: string | null
  skills: string[]
}

export interface JobDetailResult extends JobResult {
  apply_url: string | null
  remote: boolean
  is_active: boolean
  description: string | null
}

/**
 * `createdTime` is epoch milliseconds whose UTC calendar date is the posting
 * date the site shows: SMC's DevOps Director carries 1792089000000
 * (2026-10-15T18:30Z) and hirist.tech displays "Posted on: 15/10/2026".
 * Reading it in IST would land on the 16th, so the date is cut in UTC.
 */
export function contractDate(ms: number | null | undefined): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null
  return new Date(ms).toISOString().slice(0, 10)
}

/** Company name, with the padding some recruiter-entered names carry trimmed off. */
function companyName(j: HiristJob): string | null {
  const n = (j.companyData?.companyName ?? "").replace(/\s+/g, " ").trim()
  return n || null
}

function locationText(j: HiristJob): string | null {
  const names = (j.locations ?? []).map((l) => l.name).filter((n) => n && n !== "Others")
  return names.length ? names.join(", ") : null
}

function experienceText(j: HiristJob): string | null {
  if (j.min == null && j.max == null) return null
  return `${j.min ?? 0}-${j.max ?? j.min} yrs`
}

export function jobUrl(j: HiristJob): string {
  return j.jobDetailUrl || `${SITE_BASE}/j/${j.id}`
}

export function toResult(j: HiristJob): JobResult {
  return {
    id: String(j.id),
    title: decodeHtmlEntities(j.title ?? "").replace(/\s+/g, " ").trim() || "(untitled)",
    company: companyName(j),
    location: locationText(j),
    date: contractDate(j.createdTime),
    url: jobUrl(j),
    experience: experienceText(j),
    skills: (j.tags ?? []).map((t) => t.name).filter(Boolean),
  }
}

export function toDetail(j: HiristJob): JobDetailResult {
  return {
    ...toResult(j),
    apply_url: j.applyUrl || null,
    remote: j.workFromHome === 1,
    is_active: j.active === 1 && j.hasExpired !== true,
    description: cleanHtml(j.introText),
  }
}

/**
 * hirist's posting-age filter accepts 3, 7, 15, 30 or 90 days. Round a
 * requested window up to the nearest supported one so no posting inside the
 * window is lost; past 90 days, null means "all postings".
 */
export function jobageToPosting(days: number): number | null {
  for (const v of [3, 7, 15, 30, 90]) if (days <= v) return v
  return null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Characters a reader of the posting never sees but a model reading this
 * output does: C0/C1 controls other than tab, newline and carriage return, the
 * soft hyphen, bidi marks/embeddings/overrides/isolates, zero-width characters
 * and invisible operators, the BOM, variation selectors, and Unicode tag
 * characters (U+E0000-E007F), which can spell out a whole hidden instruction.
 * Listing text is third-party data, and these arrive raw in a portal's JSON or
 * markup as easily as through a numeric entity.
 */
const INVISIBLE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯︀-️﻿\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu

/** Strip INVISIBLE_CHARS from every string in a result, recursively: the CLI's output boundary. */
export function stripInvisible<T>(value: T): T {
  if (typeof value === "string") return value.replace(INVISIBLE_CHARS, "") as T
  if (Array.isArray(value)) return value.map(stripInvisible) as T
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripInvisible(v)])) as T
  }
  return value
}

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])

/** Whether an opening tag's attributes keep it from rendering: `hidden`, or an inline style that hides it. */
function isHiddenTag(attrs: string): boolean {
  for (const m of attrs.matchAll(/([^\s"'=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ""
    if (name === "hidden") return true
    if (name === "style" && /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all)\b/i.test(value)) {
      return true
    }
  }
  return false
}

/**
 * Drop markup a browser never renders - comments (including Word's
 * conditional ones), <script>/<style>/<template> blocks, and elements marked
 * hidden - before tags are stripped. A plain tag strip keeps their text, which
 * hands the model words the posting's reader never saw. CSS-only tricks
 * (off-screen, zero font size) need a renderer and are not caught here.
 */
export function visibleHtml(html: string): string {
  const src = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
  // One pass, collecting what is kept: slicing the string per hidden element
  // would make a page full of them quadratic.
  const open = /<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g
  const kept: string[] = []
  let from = 0
  let m: RegExpExecArray | null
  while ((m = open.exec(src)) !== null) {
    if (!m[2] || !isHiddenTag(m[2])) continue
    const tag = m[1].toLowerCase()
    let end = open.lastIndex
    if (!VOID_TAGS.has(tag) && !m[0].endsWith("/>")) {
      // Skip to the matching close tag, counting nested same-name elements. An
      // unclosed hidden element runs to the end: failing closed drops visible
      // text, failing open would leak the hidden text.
      const same = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi")
      same.lastIndex = end
      end = src.length
      let depth = 1
      let s: RegExpExecArray | null
      while ((s = same.exec(src)) !== null) {
        if (s[1]) depth--
        else if (!s[0].endsWith("/>")) depth++
        if (depth === 0) {
          end = same.lastIndex
          break
        }
      }
    }
    kept.push(src.slice(from, m.index))
    from = end
    open.lastIndex = end
  }
  kept.push(src.slice(from))
  return kept.join("")
}

/**
 * Strip a hirist description's HTML into readable prose: block/line-break tags
 * become newlines, entities are decoded, tags removed. Null for empty input.
 */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = visibleHtml(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

