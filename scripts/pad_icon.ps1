[void][Reflection.Assembly]::LoadWithPartialName('System.Drawing')
$sourcePath = Join-Path (Get-Location) "assets/images/coolcityicon2.png"
$outputPath = Join-Path (Get-Location) "assets/images/coolcityicon_padded.png"

if (Test-Path $sourcePath) {
    try {
        $sourceImg = [System.Drawing.Image]::FromFile($sourcePath)
        $canvasSize = [Math]::Max($sourceImg.Width, $sourceImg.Height)
        
        # We want the logo to be about 66% of the size to fit the safe zone
        $newHeight = [int]($canvasSize * 0.65)
        $newWidth = [int]($sourceImg.Width * ($newHeight / $sourceImg.Height))
        
        $bmp = New-Object System.Drawing.Bitmap $canvasSize, $canvasSize
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        $x = ($canvasSize - $newWidth) / 2
        $y = ($canvasSize - $newHeight) / 2
        
        $g.DrawImage($sourceImg, [int]$x, [int]$y, [int]$newWidth, [int]$newHeight)
        
        $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        $g.Dispose()
        $bmp.Dispose()
        $sourceImg.Dispose()
        Write-Output "Successfully created padded icon: assets/images/coolcityicon_padded.png"
    } catch {
        Write-Error "Error processing image: $_"
    }
} else {
    Write-Error "Source image not found: $sourcePath"
}
