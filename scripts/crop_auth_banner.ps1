Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\bhard\.gemini\antigravity-ide\brain\394a6ca2-c552-4daf-a8b8-854ad7972f23\.user_uploaded\media_1793195738647.png"
$destPath = "$PSScriptRoot\..\auth_banner.png"
$fullDestPath = "$PSScriptRoot\..\auth_full.png"

# Copy full image first
Copy-Item $srcPath $fullDestPath -Force

$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
# The image is 1011 x 673. The left illustration spans from x=0 to roughly x=550.
$cropRect = [System.Drawing.Rectangle]::FromLTRB(0, 0, 545, $bmp.Height)
$cropBmp = $bmp.Clone($cropRect, $bmp.PixelFormat)
$cropBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

$cropBmp.Dispose()
$bmp.Dispose()
Write-Output "Successfully saved auth_banner.png and auth_full.png"
