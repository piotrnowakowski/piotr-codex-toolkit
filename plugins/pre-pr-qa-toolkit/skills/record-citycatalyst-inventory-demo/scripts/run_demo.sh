#!/usr/bin/env bash
# One-command CityCatalyst inventory demo: validate the package, inspect the
# established setup, preflight read-only, record, collect runtime logs, verify.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: run_demo.sh [options]
  --repo-root <dir>                 CityCatalyst checkout (default: current directory)
  --profile-path <file>             Demo profile (default: <skill-dir>/assets/profiles/krakow.json)
  --base-url <url>                  App URL (default: http://localhost:3000)
  --environment-file <file>         Environment file (default: <repo>/app/.env)
  --setup-script <file>             Optional user-owned, idempotent setup hook
  --expected-database-identity <host:port/name>
  --expected-database-container <name>
  --city-name <name>  --country-name <name>  --city-locode <code>
  --city-population <n>  --region-population <n>  --country-population <n>
  --inventory-year <year>
  --cc-log-path <file>              Repeatable CityCatalyst log path for a reused process
  --ca-log-path <file>              Repeatable Climate Advisor log path (non-container CA)
  --ca-container <name>             Exact Climate Advisor container (docker or podman)
  --include-csv                     Add the optional CSV export check
  --allow-verified-demo-cleanup     Authorize the one reviewed cleanup-proposal.json deletion
  --package-only                    Test the bundled package without the live app
  --validate-only | --probe-only    Stop after read-only preflight
  --continue-on-probe-failure       Record even when preflight fails
  --do-not-start-app                Fail when the app is down
  --keep-app-running                Keep an app process started by this launcher
  --headless                        Record without showing the browser
EOF
}

repo_root="$PWD"
profile_path=""
base_url="http://localhost:3000"
environment_file=""
setup_script=""
expected_identity="${CITYCATALYST_EXPECTED_DB_IDENTITY:-}"
expected_container="${CITYCATALYST_EXPECTED_DB_CONTAINER:-}"
city_name=""
country_name=""
city_locode=""
city_population=""
region_population=""
country_population=""
inventory_year=""
cc_log_paths=()
ca_log_paths=()
ca_container="${CITYCATALYST_CA_CONTAINER:-}"
include_csv=false
allow_cleanup=false
package_only=false
validate_only=false
continue_on_probe_failure=false
do_not_start_app=false
keep_app_running=false
headless=false

while (($#)); do
  case "$1" in
    --repo-root) repo_root="$2"; shift 2 ;;
    --profile-path) profile_path="$2"; shift 2 ;;
    --base-url) base_url="$2"; shift 2 ;;
    --environment-file) environment_file="$2"; shift 2 ;;
    --setup-script) setup_script="$2"; shift 2 ;;
    --expected-database-identity) expected_identity="$2"; shift 2 ;;
    --expected-database-container) expected_container="$2"; shift 2 ;;
    --city-name) city_name="$2"; shift 2 ;;
    --country-name) country_name="$2"; shift 2 ;;
    --city-locode) city_locode="$2"; shift 2 ;;
    --city-population) city_population="$2"; shift 2 ;;
    --region-population) region_population="$2"; shift 2 ;;
    --country-population) country_population="$2"; shift 2 ;;
    --inventory-year) inventory_year="$2"; shift 2 ;;
    --cc-log-path) cc_log_paths+=("$2"); shift 2 ;;
    --ca-log-path) ca_log_paths+=("$2"); shift 2 ;;
    --ca-container) ca_container="$2"; shift 2 ;;
    --include-csv) include_csv=true; shift ;;
    --allow-verified-demo-cleanup) allow_cleanup=true; shift ;;
    --package-only) package_only=true; shift ;;
    --validate-only|--probe-only) validate_only=true; shift ;;
    --continue-on-probe-failure) continue_on_probe_failure=true; shift ;;
    --do-not-start-app) do_not_start_app=true; shift ;;
    --keep-app-running) keep_app_running=true; shift ;;
    --headless) headless=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 64 ;;
  esac
done

die() { echo "run_demo: $*" >&2; exit 1; }

app_healthy() {
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "${base_url%/}/api/auth/csrf/" 2>/dev/null || true)"
  [[ "$code" == "200" ]]
}

demo_slug() {
  local slug
  slug="$(printf '%s' "$1" | LC_ALL=C tr '[:upper:]' '[:lower:]' | LC_ALL=C sed -E 's/[^a-z0-9.-]+/-/g; s/^-+//; s/-+$//')"
  printf '%s' "${slug:-city}"
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
skill_root="$(dirname -- "$script_dir")"
skills_root="$(dirname -- "$skill_root")"
recorder="$skills_root/browser-demo-recorder/scripts/record_demo.cjs"
scenario="$script_dir/inventory_scenario.cjs"
probe="$script_dir/probe_surfaces.cjs"
verifier="$script_dir/verify_artifacts.cjs"
runtime_log_collector="$script_dir/collect_runtime_logs.cjs"
report_template="$skill_root/references/report-template.md"
helper="$script_dir/citycatalyst_ui.cjs"
self_test="$script_dir/self_test.cjs"
inspector="$script_dir/inspect_current_setup.sh"
[[ -n "$profile_path" ]] || profile_path="$skill_root/assets/profiles/krakow.json"

resolved_repo="$(realpath -e -- "$repo_root")" || die "Repository root not found: $repo_root"
resolved_profile="$(realpath -e -- "$profile_path")" || die "Demo profile not found: $profile_path"

for required_file in "$recorder" "$scenario" "$probe" "$verifier" "$runtime_log_collector" \
  "$report_template" "$helper" "$self_test" "$inspector" "$resolved_profile"; do
  [[ -f "$required_file" ]] || die "The reusable demo package is incomplete. Missing: $required_file"
done
command -v node >/dev/null 2>&1 || die "Node.js is required to run the CityCatalyst demo package (Omarchy: mise use -g node@lts; Fedora: sudo dnf install nodejs)."
command -v curl >/dev/null 2>&1 || die "curl is required for app health checks."

# Syntax-check every bundled script in parallel.
check_pids=()
check_files=("$scenario" "$probe" "$verifier" "$runtime_log_collector" "$helper" "$self_test")
for script_path in "${check_files[@]}"; do
  node --check "$script_path" & check_pids+=("$!")
done
for index in "${!check_pids[@]}"; do
  wait "${check_pids[$index]}" || die "JavaScript syntax validation failed: ${check_files[$index]}"
done
node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$resolved_profile" 2>/dev/null \
  || die "Demo profile is not valid JSON: $resolved_profile"
node "$self_test" "$resolved_profile" >/dev/null || die "Reusable package self-test failed."

[[ -f "$resolved_repo/app/package.json" ]] || die "This does not look like a CityCatalyst checkout: $resolved_repo"

if [[ "$package_only" == true ]]; then
  SKILL_ROOT="$skill_root" PROFILE="$resolved_profile" SCENARIO="$scenario" PROBE="$probe" \
  VERIFIER="$verifier" COLLECTOR="$runtime_log_collector" TEMPLATE="$report_template" \
  node -e '
const e = process.env;
console.log(JSON.stringify({
  status: "package-valid",
  skillRoot: e.SKILL_ROOT,
  profile: e.PROFILE,
  scenario: e.SCENARIO,
  probe: e.PROBE,
  verifier: e.VERIFIER,
  runtimeLogCollector: e.COLLECTOR,
  reportTemplate: e.TEMPLATE,
  repositoryOutputScenarioRequired: false,
}, null, 2));'
  exit 0
fi

[[ -n "$environment_file" ]] || environment_file="$resolved_repo/app/.env"
env_path="$(realpath -e -- "$environment_file")" || die "Environment file not found: $environment_file"

# Read KEY=VALUE without sourcing the file, trimming whitespace and one layer of quotes.
env_value() {
  local line value
  line="$(grep -E "^$1=" "$env_path" | tail -n 1 || true)"
  [[ -n "$line" ]] || return 0
  value="${line#*=}"
  value="$(printf '%s' "$value" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  printf '%s' "$value"
}

container_runtime=""
for candidate in docker podman; do
  if command -v "$candidate" >/dev/null 2>&1; then container_runtime="$candidate"; break; fi
done

app_dir="$resolved_repo/app"
app_pid=""
run_dir=""
take_name=""
run_started_at=""
app_stdout_raw=""
app_stderr_raw=""
probe_exit=""
recorder_exit=""
verification_exit=""
final_exit=0

collect_runtime_logs() {
  local cc_sources=() ca_sources=() cc_reason ca_reason="" container="" matches count
  local runtime_temp="" runtime_rc=0 path args=()
  for path in "${cc_log_paths[@]}"; do [[ -n "$path" ]] && cc_sources+=("$path"); done
  if [[ -n "$app_pid" ]]; then
    [[ -n "$app_stdout_raw" ]] && cc_sources+=("$app_stdout_raw")
    [[ -n "$app_stderr_raw" ]] && cc_sources+=("$app_stderr_raw")
  fi
  if ((${#cc_sources[@]} == 0)); then
    cc_reason="The launcher reused an existing CityCatalyst process and no --cc-log-path was supplied."
  else
    cc_reason="Configured CityCatalyst log sources were unavailable."
  fi

  for path in "${ca_log_paths[@]}"; do [[ -n "$path" ]] && ca_sources+=("$path"); done
  if ((${#ca_sources[@]} == 0)); then
    if [[ -z "$container_runtime" ]]; then
      ca_reason="Docker or Podman was unavailable and no --ca-log-path was supplied."
    else
      container="$ca_container"
      if [[ -z "$container" ]]; then
        matches="$("$container_runtime" ps --format '{{.Names}}|{{.Image}}' 2>/dev/null \
          | grep -Ei '(climate[-_]?advisor|citycatalyst.*\bca\b)' || true)"
        count="$(printf '%s' "$matches" | grep -c . || true)"
        if [[ "$count" == 1 ]]; then
          container="${matches%%|*}"
        elif ((count > 1)); then
          ca_reason="Multiple Climate Advisor containers matched; provide --ca-container."
        else
          ca_reason="No Climate Advisor container matched and no --ca-log-path was supplied."
        fi
      fi
      if [[ -n "$container" ]]; then
        runtime_temp="$(mktemp --tmpdir citycatalyst-ca-log-XXXXXXXX.log)"
        if "$container_runtime" logs --since "$run_started_at" "$container" >"$runtime_temp" 2>&1; then
          ca_sources+=("$runtime_temp")
        else
          ca_reason="${container_runtime^} logs failed for Climate Advisor container $container."
        fi
      fi
    fi
  fi
  if [[ -z "$ca_reason" ]] && ((${#ca_sources[@]} == 0)); then
    ca_reason="Configured Climate Advisor log sources were unavailable."
  fi

  args=("$runtime_log_collector" --run-dir "$run_dir" --since "$run_started_at"
    --cc-unavailable-reason "$cc_reason" --ca-unavailable-reason "$ca_reason")
  for path in "${cc_sources[@]}"; do args+=(--cc-log "$path"); done
  for path in "${ca_sources[@]}"; do args+=(--ca-log "$path"); done
  node "${args[@]}" >/dev/null || runtime_rc=$?
  [[ -n "$runtime_temp" ]] && rm -f -- "$runtime_temp"
  if ((runtime_rc != 0)); then
    echo "Runtime log collector failed with exit code $runtime_rc." >&2
    return "$runtime_rc"
  fi
}

# Stop only the process group started by this launcher (setsid makes it the leader).
stop_owned_app() {
  [[ -n "$app_pid" ]] || return 0
  kill -TERM -- "-$app_pid" 2>/dev/null || return 0
  for _ in {1..20}; do
    kill -0 -- "-$app_pid" 2>/dev/null || return 0
    sleep 0.25
  done
  kill -KILL -- "-$app_pid" 2>/dev/null || true
}

finish() {
  local status=$?
  trap - EXIT INT TERM
  set +e
  if ((status != 0 && final_exit == 0)); then final_exit=$status; fi
  if [[ -n "$app_pid" && "$keep_app_running" != true ]]; then stop_owned_app; fi
  if [[ -n "$run_dir" && -n "$run_started_at" ]]; then
    collect_runtime_logs || echo "WARNING: Runtime log collection failed." >&2
  fi
  [[ -n "$app_stdout_raw" ]] && rm -f -- "$app_stdout_raw"
  [[ -n "$app_stderr_raw" ]] && rm -f -- "$app_stderr_raw"
  exit "$final_exit"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export DEMO_EMAIL="${DEMO_EMAIL:-$(env_value DEFAULT_ADMIN_EMAIL)}"
export DEMO_PASSWORD="${DEMO_PASSWORD:-$(env_value DEFAULT_ADMIN_PASSWORD)}"
if [[ -z "$DEMO_EMAIL" || -z "$DEMO_PASSWORD" ]]; then
  die "Set DEMO_EMAIL and DEMO_PASSWORD, or provide DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD in the selected environment file."
fi

if [[ -n "$setup_script" ]]; then
  resolved_setup_script="$(realpath -e -- "$setup_script")" || die "Optional setup hook not found: $setup_script"
  bash "$resolved_setup_script" --repo-root "$resolved_repo" --environment-file "$env_path" --base-url "$base_url" \
    || die "Optional setup hook failed: $resolved_setup_script"
fi

inspection_exit=0
inspection="$(bash "$inspector" \
  --repo-root "$resolved_repo" \
  --environment-file "$env_path" \
  --base-url "$base_url" \
  --expected-database-identity "$expected_identity" \
  --expected-database-container "$expected_container" \
  --allow-app-down)" || inspection_exit=$?
if ((inspection_exit != 0)); then
  printf '%s\n' "$inspection"
  die "The configured database or its provenance is not ready (inspector exit $inspection_exit). No replacement database was created."
fi

# Playwright: app checkout, then PLAYWRIGHT_MODULE, then the shared tools cache.
shared_tools_dir="${XDG_CACHE_HOME:-$HOME/.cache}/agent-tools/playwright"
if ! (cd "$app_dir" && node -e "require.resolve('playwright')" 2>/dev/null); then
  if [[ -n "${PLAYWRIGHT_MODULE:-}" && -d "$PLAYWRIGHT_MODULE" ]]; then
    :
  elif [[ -d "$shared_tools_dir/node_modules/playwright" ]]; then
    export PLAYWRIGHT_MODULE="$shared_tools_dir/node_modules/playwright"
  else
    die "Playwright does not resolve from $app_dir, PLAYWRIGHT_MODULE, or $shared_tools_dir. Install the checkout's existing app dependencies, or install once without touching product deps: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --prefix \"$shared_tools_dir\" playwright"
  fi
fi

stamp="$(date +%Y%m%d-%H%M%S)"
profile_city_name="$(node -e 'process.stdout.write(String(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).cityName ?? ""))' "$resolved_profile")"
selected_city_name="${city_name:-${DEMO_CITY_NAME:-$profile_city_name}}"
take_name="$(demo_slug "$selected_city_name")-inventory-demo-$stamp"
run_dir="$resolved_repo/output/browser-demo-recording/runs/$take_name"
mkdir -p -- "$run_dir"
run_started_at="$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"

# Environment fallbacks accept ':' or ';' separated lists.
if ((${#cc_log_paths[@]} == 0)) && [[ -n "${CITYCATALYST_CC_LOG_PATH:-}" ]]; then
  IFS=':;' read -r -a cc_log_paths <<<"$CITYCATALYST_CC_LOG_PATH"
fi
if ((${#ca_log_paths[@]} == 0)) && [[ -n "${CITYCATALYST_CA_LOG_PATH:-}" ]]; then
  IFS=':;' read -r -a ca_log_paths <<<"$CITYCATALYST_CA_LOG_PATH"
fi

if ! app_healthy; then
  [[ "$do_not_start_app" != true ]] || die "CityCatalyst is not healthy at $base_url and --do-not-start-app was selected."
  next_command="$app_dir/node_modules/.bin/next"
  [[ -x "$next_command" ]] || die "CityCatalyst is down and the existing Next.js launcher is missing: $next_command"
  app_stdout_raw="$(mktemp --tmpdir "$take_name-app.stdout.XXXXXX.log")"
  app_stderr_raw="$(mktemp --tmpdir "$take_name-app.stderr.XXXXXX.log")"
  (cd "$app_dir" && exec setsid "$next_command" dev --webpack >"$app_stdout_raw" 2>"$app_stderr_raw" </dev/null) &
  app_pid=$!
  deadline=$((SECONDS + 90))
  until app_healthy; do
    kill -0 "$app_pid" 2>/dev/null || die "The CityCatalyst app exited during startup. Runtime logs will be collected into $run_dir."
    ((SECONDS < deadline)) || die "CityCatalyst did not become healthy within 90 seconds. Runtime logs will be collected into $run_dir."
    sleep 1
  done
fi

export BASE_URL="${base_url%/}"
export REPO_ROOT="$resolved_repo"
export RUN_DIR="$run_dir"
export DEMO_PROFILE_PATH="$resolved_profile"
export TAKE_NAME="$take_name"
[[ -n "$city_name" ]] && export DEMO_CITY_NAME="$city_name"
[[ -n "$country_name" ]] && export DEMO_COUNTRY_NAME="$country_name"
[[ -n "$city_locode" ]] && export DEMO_CITY_LOCODE="$city_locode"
[[ -n "$city_population" ]] && export DEMO_CITY_POPULATION="$city_population"
[[ -n "$region_population" ]] && export DEMO_REGION_POPULATION="$region_population"
[[ -n "$country_population" ]] && export DEMO_COUNTRY_POPULATION="$country_population"
export INCLUDE_CSV="$include_csv"
export ALLOW_VERIFIED_DEMO_CLEANUP="$allow_cleanup"
if [[ -n "$inventory_year" ]]; then export INVENTORY_YEAR="$inventory_year"; else unset INVENTORY_YEAR; fi

probe_exit=0
(cd "$app_dir" && node "$probe") || probe_exit=$?
if ((probe_exit != 0)) && [[ "$continue_on_probe_failure" != true ]]; then
  final_exit=$probe_exit
  die "Read-only browser preflight failed. See $run_dir/preflight.json."
fi

if [[ "$validate_only" == true ]]; then
  PROBE_EXIT="$probe_exit" PROFILE="$resolved_profile" RUN_DIR_OUT="$run_dir" APP_STARTED="${app_pid:+true}" \
  node -e '
const e = process.env;
console.log(JSON.stringify({
  status: e.PROBE_EXIT === "0" ? "ready" : "probe-failed",
  profile: e.PROFILE,
  runDir: e.RUN_DIR_OUT,
  preflight: require("node:path").join(e.RUN_DIR_OUT, "preflight.json"),
  appStartedByLauncher: e.APP_STARTED === "true",
}, null, 2));'
  final_exit=$probe_exit
  exit "$final_exit"
fi

recorder_args=("$recorder" --script "$scenario" --output-dir "$run_dir" --name "$take_name")
if [[ "$headless" == true ]]; then recorder_args+=(--headless); else recorder_args+=(--headed); fi
recorder_exit=0
(cd "$app_dir" && node "${recorder_args[@]}") || recorder_exit=$?

collect_runtime_logs || { final_exit=1; exit 1; }

verification_exit=0
node "$verifier" || verification_exit=$?
if ((recorder_exit != 0)); then
  final_exit=$recorder_exit
elif ((verification_exit != 0)); then
  final_exit=$verification_exit
fi

FINAL_EXIT="$final_exit" PROFILE="$resolved_profile" RUN_DIR_OUT="$run_dir" TAKE="$take_name" \
RECORDER_EXIT="$recorder_exit" VERIFICATION_EXIT="$verification_exit" APP_STARTED="${app_pid:+true}" \
node -e '
const fs = require("node:fs");
const path = require("node:path");
const e = process.env;
const runDir = e.RUN_DIR_OUT;
const inRun = (name) => path.join(runDir, name);
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);
const existing = (name) => (fs.existsSync(inRun(name)) ? inRun(name) : null);
const flowReport = readJson(inRun("flow-report.json"));
const verification = readJson(inRun("verification.json"));
console.log(JSON.stringify({
  status: e.FINAL_EXIT === "0" ? "recorded" : "failed",
  profile: e.PROFILE,
  runDir,
  takeName: e.TAKE,
  preflight: inRun("preflight.json"),
  flowReport: inRun("flow-report.json"),
  checkpoints: inRun("checkpoints.json"),
  verification: inRun("verification.json"),
  runtimeErrors: inRun("runtime-errors.json"),
  runtimeErrorReport: inRun("runtime-errors.md"),
  ccRuntimeLog: existing("cc-runtime.log"),
  caRuntimeLog: existing("ca-runtime.log"),
  media: verification?.media?.path ?? null,
  metadata: verification?.metadataPath ?? null,
  worked: [].concat(flowReport?.summary?.worked ?? []),
  didNotWork: [].concat(flowReport?.summary?.didNotWork ?? []),
  recorderExit: Number(e.RECORDER_EXIT),
  verificationExit: Number(e.VERIFICATION_EXIT),
  appStartedByLauncher: e.APP_STARTED === "true",
}, null, 2));'

exit "$final_exit"
