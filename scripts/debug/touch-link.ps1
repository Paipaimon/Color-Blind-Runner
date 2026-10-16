# Touch link probe (debug helper; not part of build or runtime).
#
# Opens the game with mobile portrait + touch emulation, dispatches synthetic finger
# gestures, and reads the page-side logs to verify the "finger -> player input" path.
# Also measures the in-play layout (HUD hidden, track flush to the bottom).
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\debug\touch-link.ps1 `
#     -Port 9222 -Url 'http://localhost:8000/?debug=touch'

param(
  [int]$Port = 9222,
  [string]$Url = 'http://localhost:8000/?debug=touch',
  [int]$Width = 390,
  [int]$Height = 844,
  [string]$Out = ''
)

$ErrorActionPreference = 'Stop'

function Get-PageTarget {
  param([int]$P)
  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    try {
      $list = Invoke-RestMethod -Uri "http://127.0.0.1:$P/json/list" -TimeoutSec 3
      $pages = @($list | Where-Object { $_.type -eq 'page' -and $_.webSocketDebuggerUrl })
      if ($pages.Count -gt 0) { return $pages[0] }
    } catch { Start-Sleep -Milliseconds 400 }
  }
  throw 'page target not found'
}

$target = Get-PageTarget -P $Port
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()

$script:msgId = 0
$script:buffer = New-Object byte[] 33554432

function Send-Cdp {
  param([string]$Method, [hashtable]$Params = @{})
  $script:msgId++
  $id = $script:msgId
  $payload = [ordered]@{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  if (-not $ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait(15000)) {
    throw "send timeout: $Method"
  }
  while ($true) {
    $seg = [ArraySegment[byte]]::new($script:buffer)
    $recv = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None)
    if (-not $recv.Wait(20000)) { throw "recv timeout: $Method" }
    $res = $recv.Result
    $text = [Text.Encoding]::UTF8.GetString($script:buffer, 0, $res.Count)
    try { $msg = $text | ConvertFrom-Json } catch { continue }
    if ($msg.id -eq $id) {
      if ($msg.error) { throw ('CDP error: ' + ($msg.error | ConvertTo-Json -Compress)) }
      return $msg.result
    }
  }
}

function Eval-Js {
  param([string]$Expression)
  $p = @{}
  $p['expression'] = [string]$Expression
  $p['returnByValue'] = $true
  return (Send-Cdp -Method 'Runtime.evaluate' -Params $p).result.value
}

function Send-Touch {
  param([string]$Type, [double]$X, [double]$Y)
  $pt = [ordered]@{ x = [Math]::Round($X); y = [Math]::Round($Y); radiusX = 8; radiusY = 8; force = 1 }
  $p = @{}
  $p['type'] = [string]$Type
  if ($Type -eq 'touchEnd') {
    $p['touchPoints'] = @()
    $p['changedTouchPoints'] = @($pt)
  } else {
    $p['touchPoints'] = @($pt)
  }
  Send-Cdp -Method 'Input.dispatchTouchEvent' -Params $p | Out-Null
}

Send-Cdp -Method 'Page.enable' | Out-Null
Send-Cdp -Method 'Runtime.enable' | Out-Null

$p = @{}
$p['width'] = $Width; $p['height'] = $Height; $p['deviceScaleFactor'] = 3; $p['mobile'] = $true
$p['screenWidth'] = $Width; $p['screenHeight'] = $Height
Send-Cdp -Method 'Emulation.setDeviceMetricsOverride' -Params $p | Out-Null

$p = @{}
$p['enabled'] = $true; $p['maxTouchPoints'] = 5
Send-Cdp -Method 'Emulation.setTouchEmulationEnabled' -Params $p | Out-Null

$p = @{}
$p['userAgent'] = [string]'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
$p['platform'] = [string]'Linux armv8l'
Send-Cdp -Method 'Emulation.setUserAgentOverride' -Params $p | Out-Null

$p = @{}
$p['url'] = [string]$Url
Send-Cdp -Method 'Page.navigate' -Params $p | Out-Null

Start-Sleep -Seconds 3

$metrics = Eval-Js -Expression "(function(){var cv=document.getElementById('gameCanvas');if(!cv)return JSON.stringify({error:'no canvas'});var r=cv.getBoundingClientRect();return JSON.stringify({viewport:window.innerWidth+'x'+window.innerHeight,gameState:cv.dataset.gameState,layout:cv.dataset.layout,display:cv.dataset.displayWidth+'x'+cv.dataset.displayHeight,internal:cv.width+'x'+cv.height,rect:Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)});})()"

# Enter the in-play UI state (hide HUD, track fills and sits at the bottom).
# Real flow calls ViewportManager.refreshLayout(); emulate the relayout by
# re-applying the device metrics, which triggers the same observer path.
$null = Eval-Js -Expression "(function(){var w=document.querySelector('.game-wrapper');w.dataset.playing='true';document.body.dataset.playing='true';return 'applied';})()"

$p = @{}
$p['width'] = $Width; $p['height'] = ($Height - 1); $p['deviceScaleFactor'] = 3; $p['mobile'] = $true
$p['screenWidth'] = $Width; $p['screenHeight'] = $Height
Send-Cdp -Method 'Emulation.setDeviceMetricsOverride' -Params $p | Out-Null
Start-Sleep -Milliseconds 300
$p['height'] = $Height
Send-Cdp -Method 'Emulation.setDeviceMetricsOverride' -Params $p | Out-Null
Start-Sleep -Milliseconds 600

$playLayout = Eval-Js -Expression "(function(){var cv=document.getElementById('gameCanvas');var hd=document.querySelector('.game-header');var ft=document.querySelector('.game-footer');var bar=document.getElementById('statusBar');var r=cv.getBoundingClientRect();function vis(el){return el?getComputedStyle(el).display:'-'}return JSON.stringify({viewport:window.innerWidth+'x'+window.innerHeight,canvas:Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height),canvasFillRatio:+(r.width/window.innerWidth).toFixed(3),canvasBottomGap:Math.round(window.innerHeight-r.bottom),headerDisplay:vis(hd),statusBarDisplay:vis(bar),footerDisplay:vis(ft),display:cv.dataset.displayWidth+'x'+cv.dataset.displayHeight,layout:cv.dataset.layout});})()"

$rect = (Eval-Js -Expression "(function(){var r=document.getElementById('gameCanvas').getBoundingClientRect();return JSON.stringify({l:r.left,t:r.top,w:r.width,h:r.height});})()") | ConvertFrom-Json

$cy = [Math]::Min($rect.t + $rect.h * 0.62, $Height - 12)
$sx = $rect.l + $rect.w * 0.25
$mx = $rect.l + $rect.w * 0.50
$ex = $rect.l + $rect.w * 0.75

# 1) swipe right (first action, to avoid state pollution)
$null = Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];'
Send-Touch -Type 'touchStart' -X $sx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $mx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $ex -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchEnd' -X $ex -Y $cy
Start-Sleep -Milliseconds 350
$swipeRight1 = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

# 2) swipe right again (same gesture, repeat)
$null = Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];'
Send-Touch -Type 'touchStart' -X $sx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $mx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $ex -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchEnd' -X $ex -Y $cy
Start-Sleep -Milliseconds 350
$swipeRight2 = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

# 3) swipe left
$null = Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];'
Send-Touch -Type 'touchStart' -X $ex -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $sx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchEnd' -X $sx -Y $cy
Start-Sleep -Milliseconds 350
$swipeLeft = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

# 4) tap left zone (tap fallback)
$null = Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];'
$tapX = $rect.l + $rect.w * 0.12
Send-Touch -Type 'touchStart' -X $tapX -Y $cy
Start-Sleep -Milliseconds 40
Send-Touch -Type 'touchEnd' -X $tapX -Y $cy
Start-Sleep -Milliseconds 350
$tapLeft = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

if ($Out -ne '') {
  try {
    $shot = Send-Cdp -Method 'Page.captureScreenshot' -Params @{ format = 'png' }
    [IO.File]::WriteAllBytes([IO.Path]::GetFullPath($Out), [Convert]::FromBase64String($shot.data))
    Write-Output ('SAVED=' + $Out)
  } catch {
    Write-Output ('SCREENSHOT_FAILED=' + $_.Exception.Message)
  }
}

Write-Output ('METRICS=' + $metrics)
Write-Output ('PLAY_LAYOUT=' + $playLayout)
Write-Output ('SWIPE_RIGHT_1ST=' + $swipeRight1)
Write-Output ('SWIPE_RIGHT_2ND=' + $swipeRight2)
Write-Output ('SWIPE_LEFT=' + $swipeLeft)
Write-Output ('TAP_LEFT=' + $tapLeft)

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', [Threading.CancellationToken]::None).Wait()
