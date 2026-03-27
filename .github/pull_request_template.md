## `<type>`: `<description>`

<!-- Replace the title above with your conventional commit message.
     Type: feat | fix | chore | docs | refactor | test | ci
     Example: feat: add style management module with Kimball analytics -->

### Summary
<!-- One sentence: what changed and why -->


### Changes
<!-- Bulleted list of specific changes -->
-

### Test Plan
- [ ] `cd agenttasks && npm run build` passes locally
- [ ] Vercel Preview deployment succeeds (check PR comment from vercel[bot])
- [ ] Relevant tests pass (`npx vitest run` in affected sub-repo)

### Vercel Build Checklist
<!-- The agenttasks build runs on every PR. Build failures on Turbo compute
     cost $0.126/min. Validate locally first. -->
- [ ] No `next/font/google` imports (use `next/font/local` — see layout.tsx)
- [ ] No new unresolved TypeScript errors in `agenttasks/`

### Breaking Changes
<!-- Leave "None" if no breaking changes -->
None

### Affected Sub-repos
<!-- Check all that apply -->
- [ ] agenttasks (Next.js webapp)
- [ ] claude-code (Scrapy spiders + extractors)
- [ ] claude-multi-agent-sdk (branded types + agent loop)
- [ ] claude-multi-agent-dispatch (10-round dispatch)
- [ ] claude-channel-dispatch-routing (channels + Kimball warehouse)
- [ ] claude-code-actions (GitHub Actions + integrations)
- [ ] claude-code-agents-python (DSPy pipeline)
- [ ] claude-code-security-review (security scanners)
- [ ] claude-dspy-crawl-planning (Shannon thinking)
