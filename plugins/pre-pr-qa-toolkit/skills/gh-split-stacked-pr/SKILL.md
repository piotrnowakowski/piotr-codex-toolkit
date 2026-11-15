---
name: "gh-split-stacked-pr"
description: "Safely split an existing large GitHub pull request into two to five ordered PRs linked via GitHub's native stacked-PR feature, preserving original code, discussion, and a recoverable backup. Use when asked to break up, divide, layer, or stack an already-open PR by subsystem while preserving completed work."
---

# Split a Large PR into a Native GitHub Stack

## Required outcome

Turn one already-open PR into a small, reviewable stack:

```text
target branch
└─ original PR, layer 1
   └─ new PR, layer 2
      └─ new PR, layer 3
```

Keep the original PR as the bottom layer by default so its URL, comments, reviews, labels, and history remain available. Create the additional layers as draft PRs unless the user explicitly asks to make them ready.

Treat these as separate success conditions:

1. Preserve the original work exactly.
2. Partition it into coherent layers that each build on the previous layer.
3. Create the expected PR base chain.
4. Link the PRs through GitHub's native stack object.
5. Verify tests, checks, code equivalence, and recovery information.
6. Add GitHub-linked stack navigation to every PR description.

## Non-negotiable safety rules

- Inspect the live repository and PR before changing refs or metadata.
- Use a temporary detached worktree. Do not disturb the user's current branch, staged files, untracked files, or dirty worktree.
- Create and verify a remote backup ref pointing to the original PR head before any force-push.
- Never use a plain `--force`. Use an explicit `--force-with-lease=<branch>:<expected-old-sha>`.
- Build layers from the original commits or exact original file/hunk contents. Do not rewrite already-completed code merely to make the split.
- Preserve the original PR's body and metadata. Add a short stack section or `[i/N]` title prefix only when useful; never erase existing context.
- After PR numbers exist, include every PR as a `#<number>` reference in the `## Stack` section of every PR body. Plain-text layer names are not sufficient: GitHub needs the PR references to render the linked titles and PR icons.
- Do not merge, close, approve, or mark PRs ready unless the user asks.
- Do not claim that a branch chain is a native stack. Verify the GitHub stack object after linking.
- If the GitHub CLI lacks `gh stack link`, stop before publishing and explain that native stack support is unavailable. Offer an ordinary dependent PR chain only as an explicit fallback.

All commands below are bash with `gh`, `git` and `jq` (Omarchy: `sudo pacman -S --needed github-cli jq`; Fedora: `sudo dnf install gh jq`).

## 1. Inspect and pin the original state

Resolve the PR, repository, base branch, head branch, base SHA, and head SHA from GitHub rather than assuming local refs are current.

```bash
pr_number=123
repo_name=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
pr_data=$(gh api "repos/$repo_name/pulls/$pr_number")
base_branch=$(echo "$pr_data" | jq -r '.base.ref')
head_branch=$(echo "$pr_data" | jq -r '.head.ref')
base_tip=$(echo "$pr_data" | jq -r '.base.sha')
old_head=$(echo "$pr_data" | jq -r '.head.sha')

git fetch origin "$base_branch" "$head_branch"
original_base=$(git merge-base "$base_tip" "$old_head")
git status --short --branch
gh pr view "$pr_number" --json number,url,title,body,state,isDraft,baseRefName,headRefName,headRefOid,labels,assignees,milestone,reviewRequests
```

Record the original changed paths, commit list, and combined diff. Prefer commit-aligned layers when the history already has useful boundaries.

```bash
git log --reverse --oneline "$original_base..$old_head"
git diff --name-status --no-renames "$original_base..$old_head"
git diff --stat "$original_base..$old_head"
```

Check whether the target branch and PR both changed any of the same paths since their merge base. If they overlap, do not silently overwrite upstream work. Resolve or rebase in the temporary worktree, then repeat all preservation checks.

## 2. Create and verify the recovery branch

Choose a unique backup name that identifies the ticket or PR and original SHA. Never overwrite an existing backup ref.

```bash
short_sha=${old_head:0:7}
backup_branch="stack/pr-$pr_number-pre-stack-backup-$short_sha"
git ls-remote --exit-code --heads origin "refs/heads/$backup_branch"
```

If the lookup finds no existing ref, create it:

```bash
git push origin "$old_head:refs/heads/$backup_branch"
backup_result=$(git ls-remote --heads origin "refs/heads/$backup_branch")
```

Continue only when `$backup_result` reports exactly `$old_head`. Keep this branch after the split unless the user explicitly requests deletion.

## 3. Design the layers

Choose two to five layers based on dependency direction, not similar file count. Prefer this order:

1. Schema, migrations, models, types, and low-level persistence.
2. Domain services and internal APIs.
3. External API routes, clients, adapters, or proxies.
4. UI integration and user-facing behavior.
5. Tests or documentation only when they form a genuinely independent review unit; otherwise keep them beside the code they verify.

For each proposed layer, list: its purpose; its source commits, files, or hunks; its direct tests; why later layers depend on it.

Use whole commits first, whole files second, and individual hunks only when a file genuinely spans responsibilities. Ensure every original change belongs to exactly one layer and every intermediate layer remains buildable.

If the user specified the count or boundaries, follow them when technically valid. Otherwise choose the smallest coherent stack and state the split before remote mutation.

## 4. Reconstruct the stack without rebuilding code

Create a detached temporary worktree at the pinned target SHA:

```bash
starting_location=$(pwd)
stack_worktree=$(mktemp -d -t stack-XXXXXX)
git worktree add --detach "$stack_worktree" "$base_tip"
cd "$stack_worktree"
```

Construct each layer in order and record its commit SHA.

- For commit-aligned layers, cherry-pick the original commits.
- For file-aligned layers, restore the exact versions from `$old_head`:

```bash
git restore --source "$old_head" --staged --worktree -- <layer-paths>
git commit -m "<layer commit message>"
layer_sha=$(git rev-parse HEAD)
```

- For hunk-aligned layers, apply hunks taken directly from `git diff $original_base $old_head -- <path>`. Do not recreate their content from memory.
- Include renamed files as both old and new paths.
- Include tests in the same layer as the behavior they validate.

After the top layer, run a preservation check that confirms the union of all layer diffs equals the original PR diff exactly (no missing or extra hunks) — for example, generate the combined diff of the reconstructed layers and `diff` it against `git diff $original_base $old_head`. Do not publish unless the diffs match. If the target branch advances, fetch it, rebuild or rebase the complete local stack onto the new pinned tip, and repeat the verification. Stop on conflicts rather than improvising.

## 5. Test each layer before publishing

Check out or detach at each layer SHA and run the smallest meaningful build, lint, type, migration, and test commands for that layer. Also run the original PR's relevant test set on the top layer.

Record failures that predate the split separately from failures introduced by the partition. Never change code solely to hide an unrelated existing failure.

## 6. Publish while preserving the original PR

Push the bottom layer to the original PR branch only after local equivalence and tests pass:

```bash
git push origin "$layer1_sha:refs/heads/$head_branch" --force-with-lease="$head_branch:$old_head"
```

Push later layers to new, descriptive branches:

```bash
git push origin "$layer2_sha:refs/heads/stack/<ticket>-<layer-2>"
git push origin "$layer3_sha:refs/heads/stack/<ticket>-<layer-3>"
```

Create each later PR as a draft whose base is the previous layer's head branch:

```bash
gh pr create --draft --base "$head_branch" --head "stack/<ticket>-<layer-2>" --title "[2/3] ..." --body "..."
gh pr create --draft --base "stack/<ticket>-<layer-2>" --head "stack/<ticket>-<layer-3>" --title "[3/3] ..." --body "..."
```

Confirm the original PR still exists, remains based on the target branch, and retains its prior review state. Add dependency links to the PR descriptions without replacing their substantive content.

After every PR has a number, update the `## Stack` section in every PR body. List all layers in bottom-to-top order, use the GitHub-native `#<number>` reference on every row, and bold the current row. For example, PR 42 in a three-PR stack should contain:

```markdown
## Stack

1. #41 - persistence foundation
2. **#42 - API layer** (this PR)
3. #43 - UI integration
```

GitHub expands these references into linked PR titles and icons. Do not leave entries such as `API layer` or `UI integration` without their PR numbers. Use an explicit Markdown URL only when the referenced PR is in another repository and `#<number>` would resolve incorrectly. Preserve the rest of each existing body. Read every updated body back from GitHub and verify that it contains all stack PR numbers exactly once in its `## Stack` section.

## 7. Link and verify the native GitHub stack

The native stacked-PR feature (`gh stack link`) is in public preview and its CLI/API surface may change — check current behavior before relying on this section:

```bash
gh stack --version
gh stack link --help
```

Pass PRs to `gh stack link` in bottom-to-top order:

```bash
gh stack link --base "$base_branch" $pr_number $layer2_pr $layer3_pr
```

Do not pass `--open` unless the user asked to mark all layers ready — omitting it preserves draft status.

If `gh stack link` is unavailable, do not claim that dependent branches form a native GitHub stack. Ask the user whether an ordinary dependency chain is an acceptable fallback.

Verify by querying every PR through the live GitHub API and inspecting its `stack` object:

```bash
for pr in $pr_number $layer2_pr $layer3_pr; do
  gh api -H "X-GitHub-Api-Version: 2026-03-10" "repos/$repo_name/pulls/$pr" \
    --jq '{number,state,draft,base:.base.ref,head:.head.ref,stack_number:.stack.number,stack_position:.stack.position,stack_size:.stack.size}'
done
```

Require:

- one shared non-null `stack_number`;
- one shared `stack_size` equal to the number of PRs;
- positions `1..N` in the supplied order;
- the correct branch base chain;
- open PR state.

Then verify the dedicated stack resource:

```bash
stack_number=<from above>
gh api -H "X-GitHub-Api-Version: 2026-03-10" "repos/$repo_name/stacks/$stack_number" \
  --jq '{number,id,open,base:.base.ref,size:(.pull_requests|length),pull_requests:[.pull_requests[].number]}'
```

Require the expected stack number, target base, open state, size, and PR list. Prefer the current output of `gh stack link --help` and live API responses over any cached knowledge if fields or flags change. Do not infer successful native linking from a successful command alone.

## 8. Hand off the result

Lead with whether the native stack was successfully created. Provide:

- a small bottom-to-top tree with every PR link;
- the native stack number and size;
- draft/ready state of each layer;
- the remote backup branch and immutable original SHA;
- code-preservation verification result;
- test and live CI results;
- confirmation that every PR description contains the linked stack index;
- any remaining blockers or review requirements.

Distinguish clearly between committed, pushed, PR-created, native-stack-linked, and CI-green states.

After all pushes and verification, return to the original directory and remove only the exact temporary worktree created by this run:

```bash
cd "$starting_location"
git worktree remove "$stack_worktree"
git worktree prune
```

If the temporary worktree is unexpectedly dirty, inspect it and preserve any unpublished commits before removal. Do not force-remove it blindly.

## Recovery

If the split must be undone, keep the stack untouched until the user authorizes recovery. Restore the original PR branch from the verified backup SHA with an explicit lease against the current split head, then verify the PR diff. Do not delete new PRs or branches automatically.
