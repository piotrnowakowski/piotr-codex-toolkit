#!/usr/bin/env bash
# Optional user-owned setup hook template.
# Copy this file outside the skill, edit the copy for one user's established
# CityCatalyst environment, make it executable, and pass it to run_demo.sh with
# --setup-script. It receives --repo-root, --environment-file and --base-url.
# Keep the hook idempotent. Prefer starting named existing services or processes
# (for example `docker start <name>` / `podman start <name>` or a systemd user unit).
# Do not create, reset, migrate, seed, replace, or delete a database unless the
# user explicitly requested that separate action.
set -euo pipefail

repo_root=""
environment_file=""
base_url=""
while (($#)); do
  case "$1" in
    --repo-root) repo_root="$2"; shift 2 ;;
    --environment-file) environment_file="$2"; shift 2 ;;
    --base-url) base_url="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 64 ;;
  esac
done
: "$repo_root" "$environment_file" "$base_url"

echo "No optional setup actions are configured. Existing setup will be reused."
