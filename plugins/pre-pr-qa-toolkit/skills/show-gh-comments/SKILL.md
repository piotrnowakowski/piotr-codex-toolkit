---
name: show-gh-comments
description: Inspect the open GitHub pull request for the current branch with the gh CLI, print PR comments and inline review threads, classify reviewer feedback, and propose code/test/docs fixes without making code changes. Use when the user asks to show, review, summarize, triage, or address GitHub PR comments while requiring confirmation before edits.
---

# Show GH Comments

## Workflow

Use `gh` CLI as the source of truth. Do not use the GitHub connector unless `gh` cannot provide the needed data and the user agrees to a fallback.

1. Confirm `gh` is authenticated before fetching comments:

   ```powershell
   gh auth status
   ```

   Verify the active host/account is logged in and has `repo` access; include `workflow` scope when CI or workflow checks may be inspected. If auth is missing or scopes are insufficient, ask the user to run `gh auth login`, then retry.

2. In sandboxed environments that support network escalation, run every `gh` command with elevated network access. If `gh auth status` is blocked by sandboxing, rerun it with `sandbox_permissions=require_escalated`. If the current environment forbids escalation, run normally and clearly report any network/auth failure.

3. From the repository root on the branch under review, run this skill's bundled script:

   ```powershell
   python C:\Users\WBW\.codex\skills\show-gh-comments\scripts\fetch_comments.py
   ```

   The script finds the open PR for the current branch, prints PR conversation comments, review submissions, and inline review-comment threads. Use `--pr <number-or-url>` or `--repo owner/name` only when the current branch cannot be resolved automatically.

4. Read the script output and capture both reviewer comments and existing author replies in the same thread. The summary must reflect the reviewer concern and whether the author has already responded.

5. Do not edit files, apply patches, stage, commit, or push in this skill's first pass. Present review-only fixes and ask which numbered items the user wants implemented.

## Summary Format

Number every actionable review thread and standalone PR/review comment. Classify each item as `bug`, `test gap`, `docs drift`, `naming/style`, or `open question`. Do not use tables.

For inline comments, use the heading:

```markdown
## <number>. <file>:<line>
```

For PR-level comments without a file and line, use:

```markdown
## <number>. PR conversation
```

For review submissions without a file and line, use:

```markdown
## <number>. PR review
```

Each item must use this exact structure:

```markdown
## <number>. <file>:<line>

> <reviewer's exact comment text>

Comment exact text: "<reviewer's exact comment text>"

What the comment is about: <plain-language concern>

Is it valid: <yes, partially, or no>. <short justification>

How we can adjust our code to match the reviewer requirements: <target file or subsystem, intended change, and whether tests or docs need updates>

Existing response: <quote or concise summary of author reply, only if the thread already contains one>

---
```

Keep each section concise. If a comment is not actionable, still number it and classify it as `open question` or `naming/style` as appropriate, then explain why no code change is proposed.

## Confirmation Gate

After listing the items, ask which item numbers should be implemented. Stop there until the user explicitly confirms. When the user confirms, implement only the selected items and preserve unrelated worktree changes.

If `gh` hits auth, permission, or rate-limit errors mid-run, ask the user to re-authenticate with `gh auth login`, then retry the failed command.
