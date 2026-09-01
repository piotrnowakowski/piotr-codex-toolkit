param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$EnvironmentFile = "",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$ExpectedDatabaseIdentity = $env:CITYCATALYST_EXPECTED_DB_IDENTITY,
  [string]$ExpectedDatabaseContainer = $env:CITYCATALYST_EXPECTED_DB_CONTAINER,
  [switch]$AllowAppDown
)

$ErrorActionPreference = "Stop"

function Test-TcpEndpoint {
  param(
    [string]$ComputerName,
    [int]$Port,
    [int]$TimeoutMilliseconds = 3000
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.ConnectAsync($ComputerName, $Port)
    return $connect.Wait($TimeoutMilliseconds) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

$resolvedRepo = (Resolve-Path -LiteralPath $RepoRoot).Path
if (-not $EnvironmentFile) {
  $EnvironmentFile = Join-Path $resolvedRepo "app\.env"
}
$resolvedEnvironmentFile = (Resolve-Path -LiteralPath $EnvironmentFile).Path

$config = @{}
Get-Content -LiteralPath $resolvedEnvironmentFile | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $config[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

$databaseHost = $config["DATABASE_HOST"]
$databasePortText = $config["DATABASE_PORT"]
$databaseName = $config["DATABASE_NAME"]
if (-not $databaseHost -or -not $databasePortText -or -not $databaseName) {
  throw "DATABASE_HOST, DATABASE_PORT, and DATABASE_NAME are required in $resolvedEnvironmentFile"
}
$databasePort = [int]$databasePortText
$databaseReachable = Test-TcpEndpoint -ComputerName $databaseHost -Port $databasePort

$appHealthy = $false
try {
  $health = Invoke-WebRequest -Uri "$BaseUrl/api/auth/csrf/" -UseBasicParsing -TimeoutSec 15
  $appHealthy = $health.StatusCode -eq 200
} catch {
  $appHealthy = $false
}

$identity = "$databaseHost`:$databasePort/$databaseName"
$databaseContainer = $null
$databaseContainerImage = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $dockerRows = docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>$null
  foreach ($row in $dockerRows) {
    $parts = $row -split '\|', 3
    if ($parts.Count -eq 3 -and $parts[2].Contains(":${databasePort}->5432/tcp")) {
      $databaseContainer = $parts[0]
      $databaseContainerImage = $parts[1]
      break
    }
  }
}

$identityMatches = -not $ExpectedDatabaseIdentity -or $identity -eq $ExpectedDatabaseIdentity
$containerMatches = -not $ExpectedDatabaseContainer -or $databaseContainer -eq $ExpectedDatabaseContainer
$suspiciousContainer = $databaseContainer -match '(?i)(codex|demo|temp|test)'
$provenanceWarning = $null
if ($suspiciousContainer -and -not $ExpectedDatabaseIdentity -and -not $ExpectedDatabaseContainer) {
  $provenanceWarning = "Database container name looks disposable. Confirm the expected identity or container before recording."
}

$result = [ordered]@{
  policy = "reuse-current-setup-only"
  repoRoot = $resolvedRepo
  environmentFile = $resolvedEnvironmentFile
  database = [ordered]@{
    identity = $identity
    reachable = $databaseReachable
    dockerContainer = $databaseContainer
    dockerImage = $databaseContainerImage
    expectedIdentity = $ExpectedDatabaseIdentity
    expectedContainer = $ExpectedDatabaseContainer
    provenanceVerified = $identityMatches -and $containerMatches
    provenanceWarning = $provenanceWarning
  }
  app = [ordered]@{
    baseUrl = $BaseUrl
    healthy = $appHealthy
  }
  mutationsPerformed = $false
}

$result | ConvertTo-Json -Depth 4
if (-not $databaseReachable) { exit 2 }
if (-not $identityMatches) { exit 4 }
if (-not $containerMatches) { exit 5 }
if (-not $appHealthy -and -not $AllowAppDown) { exit 3 }
