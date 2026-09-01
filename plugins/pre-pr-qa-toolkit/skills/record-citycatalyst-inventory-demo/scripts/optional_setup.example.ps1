param(
  [string]$RepoRoot,
  [string]$EnvironmentFile,
  [string]$BaseUrl
)

$ErrorActionPreference = "Stop"

# Optional user-owned setup hook template.
# Copy this file outside the skill, edit the copy for one user's established
# CityCatalyst environment, and pass it to run_demo.ps1 with -SetupScript.
# Keep the hook idempotent. Prefer starting named existing services or processes.
# Do not create, reset, migrate, seed, replace, or delete a database unless the
# user explicitly requested that separate action.

Write-Output "No optional setup actions are configured. Existing setup will be reused."
