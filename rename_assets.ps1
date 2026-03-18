$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$assetsDir = Join-Path $scriptDir "assets"
Set-Location $assetsDir

$imgExts = @(".jpg", ".jpeg", ".png", ".webp")
$vidExts = @(".mp4", ".webm", ".mov", ".m4v")

$imgs = Get-ChildItem -File | Where-Object { $imgExts -contains $_.Extension.ToLower() } | Sort-Object Name
$vids = Get-ChildItem -File | Where-Object { $vidExts -contains $_.Extension.ToLower() } | Sort-Object Name

for ($i = 0; $i -lt $imgs.Count; $i++) {
  $f = $imgs[$i]
  $new = ("p{0:00}{1}" -f ($i + 1), $f.Extension.ToLower())
  if ($f.Name -ne $new) {
    Rename-Item -LiteralPath $f.FullName -NewName $new
  }
}

for ($j = 0; $j -lt $vids.Count; $j++) {
  $f = $vids[$j]
  $new = ("v{0:00}{1}" -f ($j + 1), $f.Extension.ToLower())
  if ($f.Name -ne $new) {
    Rename-Item -LiteralPath $f.FullName -NewName $new
  }
}

Write-Host ("OK images={0} videos={1}" -f $imgs.Count, $vids.Count)

