# 方块同步检查（调试辅助，一行式：加载 ?debug=sync 并打印探针结果）
param([string]$Url = 'http://172.24.25.174:8000/?debug=sync', [int]$W = 390, [int]$H = 844)

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$out = (& $edge --headless=new --disable-gpu --enable-logging=stderr --v=0 --window-size=$W,$H --virtual-time-budget=4000 "--user-data-dir=$env:TEMP\edgesyncprobe" --dump-dom $Url 2>&1 | Out-String)

$m = [regex]::Match($out, '(?s)<div id="syncProbe"[^>]*>(.*?)</div>')
if ($m.Success) { Write-Output ('SYNC=' + $m.Groups[1].Value) } else { Write-Output 'SYNC=PROBE_MISSING' }

$traces = $out -split "`r?`n" | Select-String 'render\]' | ForEach-Object { $_.Line.Trim() }
if ($traces) { $traces | Select-Object -First 5 } else { Write-Output '(no render trace)' }
