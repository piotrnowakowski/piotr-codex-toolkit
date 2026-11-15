#!/usr/bin/env bash
# Read-only inspection of the established CityCatalyst setup.
# Exit codes: 2 database unreachable, 3 app unhealthy (without --allow-app-down),
# 4 database identity mismatch, 5 database container mismatch.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: inspect_current_setup.sh [options]
  --repo-root <dir>                     CityCatalyst checkout (default: current directory)
  --environment-file <file>             Environment file (default: <repo>/app/.env)
  --base-url <url>                      App URL (default: http://localhost:3000)
  --expected-database-identity <host:port/name>
  --expected-database-container <name>
  --allow-app-down                      Do not fail when the app is not healthy
EOF
}

repo_root="$PWD"
environment_file=""
base_url="http://localhost:3000"
expected_identity="${CITYCATALYST_EXPECTED_DB_IDENTITY:-}"
expected_container="${CITYCATALYST_EXPECTED_DB_CONTAINER:-}"
allow_app_down=false

while (($#)); do
  case "$1" in
    --repo-root) repo_root="$2"; shift 2 ;;
    --environment-file) environment_file="$2"; shift 2 ;;
    --base-url) base_url="$2"; shift 2 ;;
    --expected-database-identity) expected_identity="$2"; shift 2 ;;
    --expected-database-container) expected_container="$2"; shift 2 ;;
    --allow-app-down) allow_app_down=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 64 ;;
  esac
done

resolved_repo="$(realpath -e -- "$repo_root")"
[[ -n "$environment_file" ]] || environment_file="$resolved_repo/app/.env"
resolved_env="$(realpath -e -- "$environment_file")"

# Read KEY=VALUE without sourcing the file, trimming whitespace and one layer of quotes.
env_value() {
  local line value
  line="$(grep -E "^$1=" "$resolved_env" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  value="${line#*=}"
  value="$(printf '%s' "$value" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  printf '%s' "$value"
}

database_host="$(env_value DATABASE_HOST)"
database_port="$(env_value DATABASE_PORT)"
database_name="$(env_value DATABASE_NAME)"
if [[ -z "$database_host" || -z "$database_port" || -z "$database_name" ]]; then
  echo "DATABASE_HOST, DATABASE_PORT, and DATABASE_NAME are required in $resolved_env" >&2
  exit 1
fi
if ! [[ "$database_port" =~ ^[0-9]+$ ]]; then
  echo "DATABASE_PORT must be numeric in $resolved_env" >&2
  exit 1
fi

container_runtime=""
for candidate in docker podman; do
  if command -v "$candidate" >/dev/null 2>&1; then container_runtime="$candidate"; break; fi
done

# Run the independent probes in parallel.
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
( timeout 3 bash -c 'exec 3<>"/dev/tcp/$0/$1"' "$database_host" "$database_port" 2>/dev/null \
    && echo true || echo false ) >"$tmp_dir/db" &
( code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${base_url%/}/api/auth/csrf/" 2>/dev/null || true)"
  [[ "$code" == "200" ]] && echo true || echo false ) >"$tmp_dir/app" &
if [[ -n "$container_runtime" ]]; then
  ( "$container_runtime" ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>/dev/null || true ) >"$tmp_dir/containers" &
fi
wait

database_reachable="$(<"$tmp_dir/db")"
app_healthy="$(<"$tmp_dir/app")"
database_container=""
database_container_image=""
if [[ -f "$tmp_dir/containers" ]]; then
  while IFS='|' read -r name image ports; do
    if [[ "$ports" == *":${database_port}->5432/tcp"* ]]; then
      database_container="$name"
      database_container_image="$image"
      break
    fi
  done <"$tmp_dir/containers"
fi

identity="${database_host}:${database_port}/${database_name}"
identity_matches=true
container_matches=true
[[ -z "$expected_identity" || "$identity" == "$expected_identity" ]] || identity_matches=false
[[ -z "$expected_container" || "$database_container" == "$expected_container" ]] || container_matches=false

provenance_warning=""
if [[ "${database_container,,}" =~ (codex|demo|temp|test) && -z "$expected_identity" && -z "$expected_container" ]]; then
  provenance_warning="Database container name looks disposable. Confirm the expected identity or container before recording."
fi

provenance_verified=false
[[ "$identity_matches" == true && "$container_matches" == true ]] && provenance_verified=true

INSPECT_REPO="$resolved_repo" INSPECT_ENV="$resolved_env" INSPECT_IDENTITY="$identity" \
INSPECT_DB_REACHABLE="$database_reachable" INSPECT_CONTAINER="$database_container" \
INSPECT_IMAGE="$database_container_image" INSPECT_RUNTIME="$container_runtime" \
INSPECT_EXPECTED_IDENTITY="$expected_identity" INSPECT_EXPECTED_CONTAINER="$expected_container" \
INSPECT_PROVENANCE="$provenance_verified" INSPECT_WARNING="$provenance_warning" \
INSPECT_BASE_URL="$base_url" INSPECT_APP_HEALTHY="$app_healthy" \
node -e '
const e = process.env;
const orNull = (value) => (value ? value : null);
process.stdout.write(`${JSON.stringify({
  policy: "reuse-current-setup-only",
  repoRoot: e.INSPECT_REPO,
  environmentFile: e.INSPECT_ENV,
  database: {
    identity: e.INSPECT_IDENTITY,
    reachable: e.INSPECT_DB_REACHABLE === "true",
    containerRuntime: orNull(e.INSPECT_RUNTIME),
    dockerContainer: orNull(e.INSPECT_CONTAINER),
    dockerImage: orNull(e.INSPECT_IMAGE),
    expectedIdentity: orNull(e.INSPECT_EXPECTED_IDENTITY),
    expectedContainer: orNull(e.INSPECT_EXPECTED_CONTAINER),
    provenanceVerified: e.INSPECT_PROVENANCE === "true",
    provenanceWarning: orNull(e.INSPECT_WARNING),
  },
  app: { baseUrl: e.INSPECT_BASE_URL, healthy: e.INSPECT_APP_HEALTHY === "true" },
  mutationsPerformed: false,
}, null, 2)}\n`);
'

[[ "$database_reachable" == true ]] || exit 2
[[ "$identity_matches" == true ]] || exit 4
[[ "$container_matches" == true ]] || exit 5
if [[ "$app_healthy" != true && "$allow_app_down" != true ]]; then exit 3; fi
exit 0
