#!/usr/bin/env python3
"""Print PR comments and inline review-comment threads for the current branch."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from typing import Any


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, text=True, capture_output=True)
    if proc.returncode != 0:
        message = proc.stderr.strip() or proc.stdout.strip()
        raise RuntimeError(f"{' '.join(cmd)} failed\n{message}")
    return proc.stdout


def gh_json(args: list[str]) -> Any:
    return json.loads(run(["gh", *args]))


def gh_api_json(repo: str, endpoint: str) -> list[dict[str, Any]]:
    raw = gh_json(["api", "--paginate", "--slurp", f"repos/{repo}/{endpoint}"])
    if raw and isinstance(raw[0], list):
        return [item for page in raw for item in page]
    return raw


def quote_body(body: str) -> str:
    body = (body or "").rstrip()
    if not body:
        return "> [empty]"
    return "\n".join(f"> {line}" if line else ">" for line in body.splitlines())


def user_login(obj: dict[str, Any]) -> str:
    user = obj.get("user") or obj.get("author") or {}
    return user.get("login") or "unknown"


def line_label(comment: dict[str, Any]) -> str:
    path = comment.get("path") or "unknown-file"
    line = comment.get("line") or comment.get("original_line") or comment.get("position") or "unknown"
    return f"{path}:{line}"


def print_comment(prefix: str, comment: dict[str, Any], pr_author: str) -> None:
    login = user_login(comment)
    role = "author reply" if login == pr_author else "reviewer"
    created = comment.get("created_at") or comment.get("submitted_at") or ""
    url = comment.get("html_url") or comment.get("url") or ""
    state = comment.get("state")
    state_suffix = f" state={state}" if state else ""
    print(f"{prefix} {login} ({role}) {created}{state_suffix}")
    if url:
        print(f"URL: {url}")
    print(quote_body(comment.get("body") or ""))


def find_pr(repo: str, pr_ref: str | None) -> dict[str, Any]:
    fields = "number,url,title,author,headRefName,baseRefName,state"
    args = ["pr", "view"]
    if pr_ref:
        args.append(pr_ref)
    args.extend(["--repo", repo, "--json", fields])
    return gh_json(args)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch PR conversation comments, review submissions, and inline review threads with gh."
    )
    parser.add_argument("--repo", help="Repository in owner/name form. Defaults to gh repo view.")
    parser.add_argument("--pr", help="PR number, URL, or branch. Defaults to PR for current branch.")
    args = parser.parse_args()

    try:
        repo = args.repo or run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).strip()
        pr = find_pr(repo, args.pr)
        number = pr["number"]
        pr_author = (pr.get("author") or {}).get("login") or ""

        issue_comments = gh_api_json(repo, f"issues/{number}/comments")
        reviews = gh_api_json(repo, f"pulls/{number}/reviews")
        review_comments = gh_api_json(repo, f"pulls/{number}/comments")
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"PR #{number}: {pr.get('title')}")
    print(f"URL: {pr.get('url')}")
    print(f"State: {pr.get('state')}")
    print(f"Branch: {pr.get('headRefName')} -> {pr.get('baseRefName')}")
    print(f"Author: {pr_author}")

    print("\n== PR CONVERSATION COMMENTS ==")
    if not issue_comments:
        print("[none]")
    for idx, comment in enumerate(issue_comments, 1):
        print(f"\n[conversation-comment {idx}]")
        print_comment("-", comment, pr_author)

    print("\n== REVIEW SUBMISSIONS ==")
    review_with_body = [review for review in reviews if (review.get("body") or "").strip()]
    if not review_with_body:
        print("[none]")
    for idx, review in enumerate(review_with_body, 1):
        print(f"\n[review-submission {idx}]")
        print_comment("-", review, pr_author)

    roots: dict[int, dict[str, Any]] = {}
    children: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for comment in review_comments:
        reply_to = comment.get("in_reply_to_id")
        if reply_to:
            children[int(reply_to)].append(comment)
        else:
            roots[int(comment["id"])] = comment

    print("\n== INLINE REVIEW THREADS ==")
    if not roots:
        print("[none]")
    for idx, root_id in enumerate(sorted(roots), 1):
        root = roots[root_id]
        thread_comments = [root, *sorted(children.get(root_id, []), key=lambda item: item.get("created_at") or "")]
        print(f"\n[review-thread {idx}] {line_label(root)}")
        if root.get("diff_hunk"):
            print("Diff hunk:")
            print(root["diff_hunk"].rstrip())
        for cidx, comment in enumerate(thread_comments, 1):
            print(f"\n[thread-comment {idx}.{cidx}] id={comment.get('id')} {line_label(comment)}")
            print_comment("-", comment, pr_author)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
