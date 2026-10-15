# 触控链路探针（调试辅助，不参与构建与游戏运行）
#
# 作用：以移动端竖屏打开 ?debug=touch（客户端进入对局并绑定真实触控处理器），
#      派发合成手指滑动，读取页面的触摸事件日志与 InputMerger 输出日志，
#      用来判断「手指滑动 → 玩家输入」这段链路是否通。
#
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File scripts\debug\touch-link.ps1 -Port 9222 -Url 'http://localhost:8000/?debug=touch'

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

$metrics = Eval-Js -Expression @'
(function(){
  var cv=document.getElementById('gameCanvas');
  if(!cv) return JSON.stringify({error:'no canvas'});
  var r=cv.getBoundingClientRect();
  return JSON.stringify({
    viewport: window.innerWidth+'x'+window.innerHeight,
    gameState: cv.dataset.gameState,
    layout: cv.dataset.layout,
    display: cv.dataset.displayWidth+'x'+cv.dataset.displayHeight,
    internal: cv.width+'x'+cv.height,
    rect: Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)
  });
})()
'@

$rect = (Eval-Js -Expression "(function(){var r=document.getElementById('gameCanvas').getBoundingClientRect();return JSON.stringify({l:r.left,t:r.top,w:r.width,h:r.height});})()") | ConvertFrom-Json

$cy = [Math]::Min($rect.t + $rect.h * 0.62, $Height - 12)
$sx = $rect.l + $rect.w * 0.25
$mx = $rect.l + $rect.w * 0.50
$ex = $rect.l + $rect.w * 0.75

# --- 1) 右滑（作为首个动作，避免状态污染） ---
Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];' | Out-Null
Send-Touch -Type 'touchStart' -X $sx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $mx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $ex -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchEnd' -X $ex -Y $cy
Start-Sleep -Milliseconds 350
$swipeLog = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

# --- 1b) 再来一次右滑（同样手势重复，用于判断是否首次失效） ---
Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];' | Out-Null
Send-Touch -Type 'touchStart' -X $sx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $mx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $ex -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchEnd' -X $ex -Y $cy
Start-Sleep -Milliseconds 350
$swipeRight2 = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

# --- 2) 左滑 ---
Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];' | Out-Null
Send-Touch -Type 'touchStart' -X $ex -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchMove' -X $sx -Y $cy
Start-Sleep -Milliseconds 60
Send-Touch -Type 'touchEnd' -X $sx -Y $cy
Start-Sleep -Milliseconds 350
$swipeLeftLog = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

# --- 3) 左侧轻触（tap 兜底） ---
Eval-Js -Expression 'window.__INPUT_LOG__=[]; window.__TOUCH_LOG__=[];' | Out-Null
$tapX = $rect.l + $rect.w * 0.12
Send-Touch -Type 'touchStart' -X $tapX -Y $cy
Start-Sleep -Milliseconds 40
Send-Touch -Type 'touchEnd' -X $tapX -Y $cy
Start-Sleep -Milliseconds 350
$tapLog = Eval-Js -Expression 'JSON.stringify({touch:window.__TOUCH_LOG__, input:window.__INPUT_LOG__})'

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
Write-Output ('SWIPE_RIGHT_1ST=' + $swipeLog)
Write-Output ('SWIPE_RIGHT_2ND=' + $swipeRight2)
Write-Output ('SWIPE_LEFT=' + $swipeLeftLog)
Write-Output ('TAP_LEFT=' + $tapLog)

$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', [Threading.CancellationToken]::None).Wait()
