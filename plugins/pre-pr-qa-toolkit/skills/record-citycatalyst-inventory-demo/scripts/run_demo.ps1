param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$ProfilePath = "",
  [string]$BaseUrl = "http://localhost:3000",
  [string]$EnvironmentFile = "",
  [string]$SetupScript = "",
  [string]$ExpectedDatabaseIdentity = $env:CITYCATALYST_EXPECTED_DB_IDENTITY,
  [string]$ExpectedDatabaseContainer = $env:CITYCATALYST_EXPECTED_DB_CONTAINER,
  [string]$CityName = "",
  [string]$CountryName = "",
  [string]$CityLocode = "",
  [string]$CityPopulation = "",
  [string]$RegionPopulation = "",
  [string]$CountryPopulation = "",
  [string]$InventoryYear = "",
  [string[]]$CcLogPath = @(),
  [string[]]$CaLogPath = @(),
  [string]$CaContainer = $env:CITYCATALYST_CA_CONTAINER,
  [switch]$IncludeCsv,
  [switch]$AllowVerifiedDemoCleanup,
  [switch]$PackageOnly,
  [switch]$ValidateOnly,
  [switch]$ProbeOnly,
  [switch]$ContinueOnProbeFailure,
  [switch]$DoNotStartApp,
  [switch]$KeepAppRunning,
  [switch]$Headless
)

$ErrorActionPreference = "Stop"

function Test-AppHealth {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri "$Url/api/auth/csrf/" -UseBasicParsing -TimeoutSec 8
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function ConvertTo-DemoSlug {
  param([string]$Value)
  $slug = $Value.ToLowerInvariant() -replace '[^a-z0-9.-]+', '-'
  $slug = $slug.Trim('-')
  if ($slug) { return $slug }
  return "city"
}

function Stop-OwnedProcessTree {
  param([int]$RootProcessId)
  $pending = [System.Collections.Generic.List[int]]::new()
  $ordered = [System.Collections.Generic.List[int]]::new()
  $pending.Add($RootProcessId)
  while ($pending.Count -gt 0) {
    $current = $pending[0]
    $pending.RemoveAt(0)
    $ordered.Add($current)
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$current" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
      $pending.Add([int]$child.ProcessId)
    }
  }
  $ids = $ordered.ToArray()
  [array]::Reverse($ids)
  foreach ($processId in $ids) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

function Save-EnvironmentValue {
  param([string]$Name)
  $item = Get-Item -LiteralPath "Env:$Name" -ErrorAction SilentlyContinue
  return [ordered]@{
    Exists = $null -ne $item
    Value = if ($item) { $item.Value } else { $null }
  }
}

function Restore-EnvironmentValue {
  param(
    [string]$Name,
    [System.Collections.IDictionary]$Saved
  )
  if ($Saved.Exists) {
    Set-Item -LiteralPath "Env:$Name" -Value $Saved.Value
  } else {
    Remove-Item -LiteralPath "Env:$Name" -ErrorAction SilentlyContinue
  }
}

function Invoke-RuntimeLogCollection {
  param(
    [string]$Collector,
    [string]$RunDirectory,
    [datetime]$Since,
    [string[]]$CcLogPaths,
    [string[]]$CaLogPaths,
    [string]$ClimateAdvisorContainer,
    [bool]$AppStartedByLauncher,
    [string]$AppStdoutPath,
    [string]$AppStderrPath
  )

  $ccSources = [System.Collections.Generic.List[string]]::new()
  foreach ($logPath in @($CcLogPaths)) {
    if ($logPath) { $ccSources.Add($logPath) }
  }
  if ($AppStartedByLauncher) {
    if ($AppStdoutPath) { $ccSources.Add($AppStdoutPath) }
    if ($AppStderrPath) { $ccSources.Add($AppStderrPath) }
  }
  $ccUnavailableReason = if ($ccSources.Count -eq 0) {
    "The launcher reused an existing CityCatalyst process and no -CcLogPath was supplied."
  } else {
    "Configured CityCatalyst log sources were unavailable."
  }

  $caSources = [System.Collections.Generic.List[string]]::new()
  foreach ($logPath in @($CaLogPaths)) {
    if ($logPath) { $caSources.Add($logPath) }
  }
  $caUnavailableReason = ""
  $dockerTempPath = $null
  try {
    if ($caSources.Count -eq 0) {
      if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $caUnavailableReason = "Docker was unavailable and no -CaLogPath was supplied."
      } else {
        $container = $ClimateAdvisorContainer
        if (-not $container) {
          $matches = @(
            docker ps --format '{{.Names}}|{{.Image}}' 2>$null |
              Where-Object { $_ -match '(?i)(climate[-_]?advisor|citycatalyst.*\bca\b)' }
          )
          if ($matches.Count -eq 1) {
            $container = ($matches[0] -split '\|', 2)[0]
          } elseif ($matches.Count -gt 1) {
            $caUnavailableReason = "Multiple Climate Advisor containers matched; provide -CaContainer."
          } else {
            $caUnavailableReason = "No Climate Advisor container matched and no -CaLogPath was supplied."
          }
        }
        if ($container) {
          $dockerTempPath = Join-Path ([System.IO.Path]::GetTempPath()) (
            "citycatalyst-ca-log-" + [guid]::NewGuid().ToString("N") + ".log"
          )
          $sinceText = $Since.ToUniversalTime().ToString("o")
          $dockerOutput = & docker logs --since $sinceText $container 2>&1
          $dockerExit = $LASTEXITCODE
          [System.IO.File]::WriteAllLines($dockerTempPath, @($dockerOutput))
          if ($dockerExit -eq 0) {
            $caSources.Add($dockerTempPath)
          } else {
            $caUnavailableReason = "Docker logs failed for Climate Advisor container $container."
          }
        }
      }
    }
    if (-not $caUnavailableReason -and $caSources.Count -eq 0) {
      $caUnavailableReason = "Configured Climate Advisor log sources were unavailable."
    }

    $arguments = @(
      $Collector,
      "--run-dir", $RunDirectory,
      "--since", $Since.ToUniversalTime().ToString("o"),
      "--cc-unavailable-reason", $ccUnavailableReason,
      "--ca-unavailable-reason", $caUnavailableReason
    )
    foreach ($source in $ccSources) {
      $arguments += @("--cc-log", $source)
    }
    foreach ($source in $caSources) {
      $arguments += @("--ca-log", $source)
    }
    & node @arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Runtime log collector failed with exit code $LASTEXITCODE."
    }
  } finally {
    if ($dockerTempPath -and (Test-Path -LiteralPath $dockerTempPath)) {
      Remove-Item -LiteralPath $dockerTempPath -Force -ErrorAction SilentlyContinue
    }
  }
}

$resolvedRepo = (Resolve-Path -LiteralPath $RepoRoot).Path
$skillRoot = Split-Path -Parent $PSScriptRoot
$skillsRoot = Split-Path -Parent $skillRoot
$recorder = Join-Path $skillsRoot "browser-demo-recorder\scripts\record_demo.cjs"
$scenario = Join-Path $PSScriptRoot "inventory_scenario.cjs"
$probe = Join-Path $PSScriptRoot "probe_surfaces.cjs"
$verifier = Join-Path $PSScriptRoot "verify_artifacts.cjs"
$runtimeLogCollector = Join-Path $PSScriptRoot "collect_runtime_logs.cjs"
$reportTemplate = Join-Path $skillRoot "references\report-template.md"
$helper = Join-Path $PSScriptRoot "citycatalyst_ui.cjs"
$selfTest = Join-Path $PSScriptRoot "self_test.cjs"
$inspector = Join-Path $PSScriptRoot "inspect_current_setup.ps1"
if (-not $ProfilePath) {
  $ProfilePath = Join-Path $skillRoot "assets\profiles\krakow.json"
}
$resolvedProfile = (Resolve-Path -LiteralPath $ProfilePath).Path

$requiredFiles = @($recorder, $scenario, $probe, $verifier, $runtimeLogCollector, $reportTemplate, $helper, $selfTest, $inspector, $resolvedProfile)
foreach ($requiredFile in $requiredFiles) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "The reusable demo package is incomplete. Missing: $requiredFile"
  }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required to run the CityCatalyst demo package."
}

foreach ($scriptPath in @($scenario, $probe, $verifier, $runtimeLogCollector, $helper, $selfTest)) {
  & node --check $scriptPath
  if ($LASTEXITCODE -ne 0) {
    throw "JavaScript syntax validation failed: $scriptPath"
  }
}
try {
  Get-Content -LiteralPath $resolvedProfile -Raw | ConvertFrom-Json | Out-Null
} catch {
  throw "Demo profile is not valid JSON: $resolvedProfile"
}
& node $selfTest $resolvedProfile
if ($LASTEXITCODE -ne 0) {
  throw "Reusable package self-test failed."
}

$appPackage = Join-Path $resolvedRepo "app\package.json"
if (-not (Test-Path -LiteralPath $appPackage -PathType Leaf)) {
  throw "This does not look like a CityCatalyst checkout: $resolvedRepo"
}

if ($PackageOnly) {
  [ordered]@{
    status = "package-valid"
    skillRoot = $skillRoot
    profile = $resolvedProfile
    scenario = $scenario
    probe = $probe
    verifier = $verifier
    runtimeLogCollector = $runtimeLogCollector
    reportTemplate = $reportTemplate
    repositoryOutputScenarioRequired = $false
  } | ConvertTo-Json -Depth 4
  exit 0
}

if (-not $EnvironmentFile) {
  $EnvironmentFile = Join-Path $resolvedRepo "app\.env"
}
$envPath = (Resolve-Path -LiteralPath $EnvironmentFile).Path

$config = @{}
Get-Content -LiteralPath $envPath | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $config[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

$managedNames = @(
  "BASE_URL",
  "REPO_ROOT",
  "RUN_DIR",
  "DEMO_PROFILE_PATH",
  "INVENTORY_YEAR",
  "TAKE_NAME",
  "DEMO_EMAIL",
  "DEMO_PASSWORD",
  "DEMO_CITY_NAME",
  "DEMO_COUNTRY_NAME",
  "DEMO_CITY_LOCODE",
  "DEMO_CITY_POPULATION",
  "DEMO_REGION_POPULATION",
  "DEMO_COUNTRY_POPULATION",
  "INCLUDE_CSV",
  "ALLOW_VERIFIED_DEMO_CLEANUP"
)
$savedEnvironment = @{}
foreach ($name in $managedNames) {
  $savedEnvironment[$name] = Save-EnvironmentValue -Name $name
}

$startedApp = $null
$runDir = $null
$takeName = $null
$probeExit = $null
$recorderExit = $null
$verificationExit = $null
$finalExit = 0
$runStartedAt = $null
$appStdoutRaw = $null
$appStderrRaw = $null

try {
  if (-not $env:DEMO_EMAIL) {
    $env:DEMO_EMAIL = $config["DEFAULT_ADMIN_EMAIL"]
  }
  if (-not $env:DEMO_PASSWORD) {
    $env:DEMO_PASSWORD = $config["DEFAULT_ADMIN_PASSWORD"]
  }
  if (-not $env:DEMO_EMAIL -or -not $env:DEMO_PASSWORD) {
    throw "Set DEMO_EMAIL and DEMO_PASSWORD, or provide DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD in the selected environment file."
  }

  if ($SetupScript) {
    $resolvedSetupScript = (Resolve-Path -LiteralPath $SetupScript).Path
    & $resolvedSetupScript -RepoRoot $resolvedRepo -EnvironmentFile $envPath -BaseUrl $BaseUrl
    if ($LASTEXITCODE -ne 0) {
      throw "Optional setup hook failed: $resolvedSetupScript"
    }
  }

  $inspection = & $inspector `
    -RepoRoot $resolvedRepo `
    -EnvironmentFile $envPath `
    -BaseUrl $BaseUrl `
    -ExpectedDatabaseIdentity $ExpectedDatabaseIdentity `
    -ExpectedDatabaseContainer $ExpectedDatabaseContainer `
    -AllowAppDown
  $inspectionExit = $LASTEXITCODE
  if ($inspectionExit -ne 0) {
    $inspection | Write-Output
    throw "The configured database or its provenance is not ready (inspector exit $inspectionExit). No replacement database was created."
  }

  $appDir = Join-Path $resolvedRepo "app"
  Push-Location $appDir
  try {
    & node -e "require.resolve('playwright')"
    if ($LASTEXITCODE -ne 0) {
      throw "Playwright does not resolve from $appDir. Install the checkout's existing app dependencies before recording."
    }
  } finally {
    Pop-Location
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $profile = Get-Content -LiteralPath $resolvedProfile -Raw | ConvertFrom-Json
  $selectedCityName = if ($CityName) {
    $CityName
  } elseif ($env:DEMO_CITY_NAME) {
    $env:DEMO_CITY_NAME
  } else {
    [string]$profile.cityName
  }
  $profileSlug = ConvertTo-DemoSlug -Value $selectedCityName
  $takeName = "$profileSlug-inventory-demo-$stamp"
  $runDir = Join-Path $resolvedRepo "output\browser-demo-recording\runs\$takeName"
  New-Item -ItemType Directory -Path $runDir -Force | Out-Null
  $runStartedAt = Get-Date

  if ($CcLogPath.Count -eq 0 -and $env:CITYCATALYST_CC_LOG_PATH) {
    $CcLogPath = @($env:CITYCATALYST_CC_LOG_PATH -split ';' | Where-Object { $_ })
  }
  if ($CaLogPath.Count -eq 0 -and $env:CITYCATALYST_CA_LOG_PATH) {
    $CaLogPath = @($env:CITYCATALYST_CA_LOG_PATH -split ';' | Where-Object { $_ })
  }

  if (-not (Test-AppHealth -Url $BaseUrl)) {
    if ($DoNotStartApp) {
      throw "CityCatalyst is not healthy at $BaseUrl and -DoNotStartApp was selected."
    }
    $nextCommand = Join-Path $appDir "node_modules\.bin\next.cmd"
    if (-not (Test-Path -LiteralPath $nextCommand -PathType Leaf)) {
      throw "CityCatalyst is down and the existing Next.js launcher is missing: $nextCommand"
    }
    $appStdoutRaw = Join-Path ([System.IO.Path]::GetTempPath()) "$takeName-app.stdout.log"
    $appStderrRaw = Join-Path ([System.IO.Path]::GetTempPath()) "$takeName-app.stderr.log"
    $startedApp = Start-Process `
      -FilePath $nextCommand `
      -ArgumentList @("dev", "--webpack") `
      -WorkingDirectory $appDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $appStdoutRaw `
      -RedirectStandardError $appStderrRaw `
      -PassThru

    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline -and -not (Test-AppHealth -Url $BaseUrl)) {
      Start-Sleep -Seconds 2
      if ($startedApp.HasExited) {
        throw "The CityCatalyst app exited during startup. Runtime logs will be collected into $runDir."
      }
    }
    if (-not (Test-AppHealth -Url $BaseUrl)) {
      throw "CityCatalyst did not become healthy within 90 seconds. Runtime logs will be collected into $runDir."
    }
  }

  $env:BASE_URL = $BaseUrl.TrimEnd("/")
  $env:REPO_ROOT = $resolvedRepo
  $env:RUN_DIR = $runDir
  $env:DEMO_PROFILE_PATH = $resolvedProfile
  $env:TAKE_NAME = $takeName
  if ($CityName) { $env:DEMO_CITY_NAME = $CityName }
  if ($CountryName) { $env:DEMO_COUNTRY_NAME = $CountryName }
  if ($CityLocode) { $env:DEMO_CITY_LOCODE = $CityLocode }
  if ($CityPopulation) { $env:DEMO_CITY_POPULATION = $CityPopulation }
  if ($RegionPopulation) { $env:DEMO_REGION_POPULATION = $RegionPopulation }
  if ($CountryPopulation) { $env:DEMO_COUNTRY_POPULATION = $CountryPopulation }
  $env:INCLUDE_CSV = if ($IncludeCsv) { "true" } else { "false" }
  $env:ALLOW_VERIFIED_DEMO_CLEANUP = if ($AllowVerifiedDemoCleanup) { "true" } else { "false" }
  if ($InventoryYear) {
    $env:INVENTORY_YEAR = $InventoryYear
  } else {
    Remove-Item Env:INVENTORY_YEAR -ErrorAction SilentlyContinue
  }

  Push-Location $appDir
  try {
    & node $probe
    $probeExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($probeExit -ne 0 -and -not $ContinueOnProbeFailure) {
    $finalExit = $probeExit
    throw "Read-only browser preflight failed. See $(Join-Path $runDir 'preflight.json')."
  }

  if ($ProbeOnly -or $ValidateOnly) {
    [ordered]@{
      status = if ($probeExit -eq 0) { "ready" } else { "probe-failed" }
      profile = $resolvedProfile
      runDir = $runDir
      preflight = Join-Path $runDir "preflight.json"
      appStartedByLauncher = $null -ne $startedApp
    } | ConvertTo-Json -Depth 4
    exit $probeExit
  }

  $recorderArguments = @(
    $recorder,
    "--script", $scenario,
    "--output-dir", $runDir,
    "--name", $takeName
  )
  $recorderArguments += if ($Headless) { "--headless" } else { "--headed" }
  Push-Location $appDir
  try {
    & node @recorderArguments
    $recorderExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  Invoke-RuntimeLogCollection `
    -Collector $runtimeLogCollector `
    -RunDirectory $runDir `
    -Since $runStartedAt `
    -CcLogPaths $CcLogPath `
    -CaLogPaths $CaLogPath `
    -ClimateAdvisorContainer $CaContainer `
    -AppStartedByLauncher ($null -ne $startedApp) `
    -AppStdoutPath $appStdoutRaw `
    -AppStderrPath $appStderrRaw

  & node $verifier
  $verificationExit = $LASTEXITCODE
  if ($recorderExit -ne 0 -or $verificationExit -ne 0) {
    $finalExit = if ($recorderExit -ne 0) { $recorderExit } else { $verificationExit }
  }

  $flowReportPath = Join-Path $runDir "flow-report.json"
  $verificationPath = Join-Path $runDir "verification.json"
  $flowReportData = if (Test-Path -LiteralPath $flowReportPath) {
    Get-Content -LiteralPath $flowReportPath -Raw | ConvertFrom-Json
  } else {
    $null
  }
  $verificationData = if (Test-Path -LiteralPath $verificationPath) {
    Get-Content -LiteralPath $verificationPath -Raw | ConvertFrom-Json
  } else {
    $null
  }

  [ordered]@{
    status = if ($finalExit -eq 0) { "recorded" } else { "failed" }
    profile = $resolvedProfile
    runDir = $runDir
    takeName = $takeName
    preflight = Join-Path $runDir "preflight.json"
    flowReport = $flowReportPath
    checkpoints = Join-Path $runDir "checkpoints.json"
    verification = $verificationPath
    runtimeErrors = Join-Path $runDir "runtime-errors.json"
    runtimeErrorReport = Join-Path $runDir "runtime-errors.md"
    ccRuntimeLog = if (Test-Path -LiteralPath (Join-Path $runDir "cc-runtime.log")) {
      Join-Path $runDir "cc-runtime.log"
    } else {
      $null
    }
    caRuntimeLog = if (Test-Path -LiteralPath (Join-Path $runDir "ca-runtime.log")) {
      Join-Path $runDir "ca-runtime.log"
    } else {
      $null
    }
    media = $verificationData.media.path
    metadata = $verificationData.metadataPath
    worked = @($flowReportData.summary.worked)
    didNotWork = @($flowReportData.summary.didNotWork)
    recorderExit = $recorderExit
    verificationExit = $verificationExit
    appStartedByLauncher = $null -ne $startedApp
  } | ConvertTo-Json -Depth 8
} catch {
  if ($finalExit -eq 0) { $finalExit = 1 }
  throw
} finally {
  if ($startedApp -and -not $KeepAppRunning) {
    Stop-OwnedProcessTree -RootProcessId $startedApp.Id
  }
  if ($runDir -and $runStartedAt) {
    try {
      Invoke-RuntimeLogCollection `
        -Collector $runtimeLogCollector `
        -RunDirectory $runDir `
        -Since $runStartedAt `
        -CcLogPaths $CcLogPath `
        -CaLogPaths $CaLogPath `
        -ClimateAdvisorContainer $CaContainer `
        -AppStartedByLauncher ($null -ne $startedApp) `
        -AppStdoutPath $appStdoutRaw `
        -AppStderrPath $appStderrRaw
    } catch {
      Write-Warning "Runtime log collection failed: $($_.Exception.Message)"
    }
  }
  foreach ($rawLogPath in @($appStdoutRaw, $appStderrRaw)) {
    if ($rawLogPath -and (Test-Path -LiteralPath $rawLogPath)) {
      Remove-Item -LiteralPath $rawLogPath -Force -ErrorAction SilentlyContinue
    }
  }
  foreach ($name in $managedNames) {
    Restore-EnvironmentValue -Name $name -Saved $savedEnvironment[$name]
  }
}

exit $finalExit
