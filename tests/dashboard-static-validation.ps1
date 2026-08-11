$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$dashboardPath = Join-Path $projectRoot 'dashboard.html'
$dashboardCssPath = Join-Path $projectRoot 'css\dashboard.css'
$layoutCssPath = Join-Path $projectRoot 'css\layout.css'
$layoutJsPath = Join-Path $projectRoot 'js\layout.js'

$html = [IO.File]::ReadAllText($dashboardPath, [Text.Encoding]::UTF8)
$css = [IO.File]::ReadAllText($dashboardCssPath, [Text.Encoding]::UTF8)
$layoutCss = [IO.File]::ReadAllText($layoutCssPath, [Text.Encoding]::UTF8)
$layoutJs = [IO.File]::ReadAllText($layoutJsPath, [Text.Encoding]::UTF8)

function Assert-Match {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Requirement
    )

    if (-not [regex]::IsMatch($Content, $Pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        throw "Missing dashboard requirement: $Requirement"
    }
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Requirement
    )

    if (-not $Condition) {
        throw "Failed dashboard requirement: $Requirement"
    }
}

Assert-Match $html 'data-page="dashboard"' 'dashboard page key'
Assert-Match $html 'data-app-sidebar' 'shared sidebar mount'
Assert-Match $html 'data-app-topbar' 'shared topbar mount'
Assert-Match $html 'href="css/layout\.css"' 'shared layout stylesheet'
Assert-Match $html 'src="js/layout\.js"' 'shared layout script'
Assert-Match $layoutJs 'class=\\?"brand-wordmark\\?"[^>]*>iRent<' 'iRent wordmark'
Assert-Match $layoutJs 'placeholder=\\?"\u641C\u5C0B\u8ECA\u724C\u3001\u8ECA\u8F1B\u3001\u6848\u4EF6\u7DE8\u865F\\?"' 'search field'
Assert-Match $layoutJs 'aria-label=\\?"\u901A\u77E5\\?"' 'notification control'
Assert-Match $layoutJs 'aria-label=\\?"\u8A0A\u606F\\?"' 'message control'
Assert-Match $layoutJs '>Celine<' 'Celine identity'
Assert-Match $layoutJs '>\u7BA1\u7406\u8005<' 'administrator role'
Assert-Match $html 'class="dashboard-metrics"' 'five-metric region'
Assert-Match $html 'class="fleet-trend-card' 'fleet trend card'
Assert-Match $html 'class="fleet-distribution-card' 'distribution card'
Assert-Match $html 'class="fleet-health-card' 'health card'
Assert-Match $html 'class="region-overview-card' 'regional overview card'
Assert-Match $html 'class="ai-alerts-card' 'AI alerts card'
Assert-Match $html 'class="priority-card' 'priority actions card'
Assert-Match $layoutCss '@media\s*\(max-width:\s*1279px\)' 'desktop-to-tablet breakpoint'
Assert-Match $layoutCss '@media\s*\(max-width:\s*899px\)' 'tablet breakpoint'
Assert-Match $layoutCss '@media\s*\(max-width:\s*639px\)' 'mobile breakpoint'
Assert-True (-not ($css -match '\.dashboard-(?:sidebar|topbar|workspace)')) 'dashboard CSS excludes shared shell rules'

$metricCount = ([regex]::Matches($html, 'class="dashboard-metric\s+is-')).Count
Assert-True ($metricCount -eq 5) 'exactly five dashboard metric cards'

$hrefPattern = 'href=["'']([^"'']+)["'']'
$localLinks = [regex]::Matches($html, $hrefPattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)

foreach ($link in $localLinks) {
    $href = $link.Groups[1].Value
    if ($href.StartsWith('#') -or $href -match '^(?:https?:|mailto:|tel:)') {
        continue
    }

    $relativeTarget = $href -replace '[?#].*$', ''
    $targetPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativeTarget))
    Assert-True ([IO.File]::Exists($targetPath)) "local link exists: $href"
}

Write-Output 'Dashboard static validation passed.'
