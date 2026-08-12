$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$pages = [ordered]@{
    'dashboard.html' = 'dashboard'
    'damage-review.html' = 'damage-review'
    'fleet.html' = 'fleet'
    'dispatch.html' = 'dispatch'
    'work-orders.html' = 'work-orders'
    'reports.html' = 'reports'
    'permissions.html' = 'permissions'
}

foreach ($entry in $pages.GetEnumerator()) {
    $pagePath = Join-Path $projectRoot $entry.Key
    $html = [IO.File]::ReadAllText($pagePath, [Text.Encoding]::UTF8)
    $required = @(
        "data-page=`"$($entry.Value)`"",
        'data-app-sidebar',
        'data-app-topbar',
        'href="css/layout.css"',
        'src="js/layout.js"'
    )

    foreach ($marker in $required) {
        if (-not $html.Contains($marker)) {
            throw "$($entry.Key) missing shared layout marker: $marker"
        }
    }

    if ($entry.Key -eq 'dashboard.html') {
        if (-not $html.Contains('class="dashboard-main"')) {
            throw 'dashboard.html lost its dashboard content container.'
        }
    } elseif (-not $html.Contains('class="page"')) {
        throw "$($entry.Key) lost its page content container."
    }
}

$layoutCssPath = Join-Path $projectRoot 'css\layout.css'
$layoutJsPath = Join-Path $projectRoot 'js\layout.js'
if (-not (Test-Path -LiteralPath $layoutCssPath -PathType Leaf)) { throw 'Missing css/layout.css.' }
if (-not (Test-Path -LiteralPath $layoutJsPath -PathType Leaf)) { throw 'Missing js/layout.js.' }

$layoutJs = [IO.File]::ReadAllText($layoutJsPath, [Text.Encoding]::UTF8)
foreach ($key in $pages.Values) {
    if (-not $layoutJs.Contains("key: '$key'")) { throw "layout.js missing page key: $key" }
}

foreach ($requiredJsMarker in @('window.IRentLayout', 'aria-current', '/api/auth/me', '/api/auth/logout')) {
    if (-not $layoutJs.Contains($requiredJsMarker)) { throw "layout.js missing marker: $requiredJsMarker" }
}

$layoutCss = [IO.File]::ReadAllText($layoutCssPath, [Text.Encoding]::UTF8)
foreach ($requiredCssMarker in @('.app-sidebar', '.app-topbar', '.app-workspace', '899px', '639px')) {
    if (-not $layoutCss.Contains($requiredCssMarker)) { throw "layout.css missing marker: $requiredCssMarker" }
}

Write-Output "Shared layout structure verification passed for $($pages.Count) pages."
