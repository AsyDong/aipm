# ============ 英语配图压缩：PNG(任意尺寸) → 288px JPEG ============
#
# 用法（在 pet-kitchen 目录）：powershell -NoProfile -File tools/compress-en-images.ps1
#
# 前置：tools/gen-en-images.mjs 生成的 public/img/en/*.png
# 后果：同名 .jpg（白底填充、288x288、质量 80），原 .png 删除。
# 原始 1024px 底档在 _scratch/en-img-1024/。
# UI 只在白底卡片上放图，透明通道白底填充后无视觉差。

Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot '..\public\img\en'
Get-ChildItem "$dir\*.png" | ForEach-Object {
  $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
  $ms = New-Object System.IO.MemoryStream(, $bytes)
  $img = [System.Drawing.Image]::FromStream($ms)

  $bmp = New-Object System.Drawing.Bitmap 288, 288
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)   # 白底：JPEG 无透明，且 UI 卡片就是白的
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, 0, 0, 288, 288)

  # JPEG 质量 80（System.Drawing 默认 ~75 偏糊，显式指定）
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]80)

  $jpg = [System.IO.Path]::ChangeExtension($_.FullName, '.jpg')
  $bmp.Save($jpg, $codec, $params)
  Remove-Item $_.FullName
  Write-Host ("  {0}  {1}KB -> {2}KB" -f $_.BaseName, [math]::Round($bytes.Length / 1KB), [math]::Round((Get-Item $jpg).Length / 1KB))

  $g.Dispose(); $bmp.Dispose(); $img.Dispose(); $ms.Dispose()
}
