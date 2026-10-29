import { describe, expect, test } from "bun:test"
import { parseJSON, runCLI } from "./helpers.ts"

// Flag validation runs before any request, so these tests make no network calls.
describe("argument validation", () => {
  test("unknown flag exits 1 with a JSON error on stderr", async () => {
    const r = await runCLI(["search", "-q", "sre", "--bogus", "x"])
    expect(r.exitCode).toBe(1)
    expect(r.stdout).toBe("")
    expect(JSON.parse(r.stderr).code).toBe("UNKNOWN_FLAG")
  })
  test("search without --query exits 1", async () => {
    const r = await runCLI(["search"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_QUERY")
  })
  test("unknown location exits 1 before searching", async () => {
    const r = await runCLI(["search", "-q", "sre", "-l", "Atlantis"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_LOCATION")
  })
  test("non-integer --jobage is rejected", async () => {
    const r = await runCLI(["search", "-q", "sre", "--jobage", "0.5"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ARG")
  })
  test("detail without an id exits 1", async () => {
    const r = await runCLI(["detail"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("NO_ID")
  })
  test("detail rejects a non-hirist URL", async () => {
    const r = await runCLI(["detail", "https://boards.greenhouse.io/acme/jobs/1679015"])
    expect(r.exitCode).toBe(1)
    expect(JSON.parse(r.stderr).code).toBe("BAD_ID")
  })
})

// One live request: hirist.tech asks for a 10-second crawl delay, so the smoke
// test stays at a single search rather than exercising every flag live.
describe("live smoke test", () => {
  test("search returns real results with id, title and url", async () => {
    const r = await runCLI(["search", "-q", "devops director", "--limit", "3"])
    const out = parseJSON<{ meta: { count: number; page: number }; results: { id: string; title: string; url: string }[] }>(r)
    expect(out.meta.page).toBe(1)
    expect(out.results.length).toBeGreaterThanOrEqual(1)
    for (const job of out.results) {
      expect(job.id).toBeTruthy()
      expect(job.title).toBeTruthy()
      expect(job.url).toStartWith("https://www.hirist.tech/")
    }
  })
})
