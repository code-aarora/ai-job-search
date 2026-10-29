# hirist-cli

Search tech jobs on [hirist.tech](https://www.hirist.tech) (India) from the command line
through the public JSON API its web app uses. Zero runtime dependencies: `bun install`
only pulls dev types for `typecheck`.

```bash
cd .agents/skills/hirist-search/cli
bun install            # dev types only
bun run src/cli.ts search -q "devops director" --jobage 7 --format table
bun run src/cli.ts detail 1679015 --format plain
bun run test           # unit tests + one live search
bun run typecheck
```

See `../SKILL.md` for flags and examples, and `../url-reference.md` for the endpoints.

Personal use only. hirist.tech's `robots.txt` asks for a 10-second crawl delay; each
invocation makes one request, so keep volume low.
