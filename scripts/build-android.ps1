$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$buildTools = Join-Path $sdkRoot 'build-tools/36.1.0'
$androidJar = Join-Path $sdkRoot 'platforms/android-36.1/android.jar'
$out = Join-Path $repoRoot 'output/native/android'
$appRoot = Join-Path $repoRoot 'native/android/app/src/main'
New-Item -ItemType Directory -Force -Path $out,(Join-Path $out 'classes'),(Join-Path $out 'dex') | Out-Null
function Run-Checked($program, $arguments) {
    & $program @arguments
    if ($LASTEXITCODE -ne 0) { throw "$program failed with exit code $LASTEXITCODE" }
}
Run-Checked (Join-Path $buildTools 'aapt2.exe') @('compile','--dir',(Join-Path $appRoot 'res'),'-o',(Join-Path $out 'resources.zip'))
$manifest = Join-Path $out 'AndroidManifest.xml'
$manifestText = [System.IO.File]::ReadAllText((Join-Path $appRoot 'AndroidManifest.xml')).Replace('<manifest ', '<manifest package="local.sunpower.operations" ')
[System.IO.File]::WriteAllText($manifest,$manifestText)
Run-Checked (Join-Path $buildTools 'aapt2.exe') @('link','--debug-mode','-I',$androidJar,'--manifest',$manifest,'--min-sdk-version','26','--target-sdk-version','35','--version-code','1','--version-name','0.1.0','-o',(Join-Path $out 'unsigned.apk'),(Join-Path $out 'resources.zip'))
$sources = @(Get-ChildItem (Join-Path $appRoot 'java') -Recurse -Filter '*.java' | ForEach-Object FullName)
Run-Checked 'javac' (@('-source','17','-target','17','-classpath',$androidJar,'-d',(Join-Path $out 'classes')) + $sources)
$classes = @(Get-ChildItem (Join-Path $out 'classes') -Recurse -Filter '*.class' | ForEach-Object FullName)
Run-Checked (Join-Path $buildTools 'd8.bat') (@('--lib',$androidJar,'--min-api','26','--output',(Join-Path $out 'dex')) + $classes)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open((Join-Path $out 'unsigned.apk'),[System.IO.Compression.ZipArchiveMode]::Update)
try { [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $out 'dex/classes.dex'),'classes.dex') | Out-Null } finally { $zip.Dispose() }
Run-Checked (Join-Path $buildTools 'zipalign.exe') @('-f','-p','4',(Join-Path $out 'unsigned.apk'),(Join-Path $out 'aligned.apk'))
$debugKey = Join-Path $out 'demo.keystore'
if (!(Test-Path -LiteralPath $debugKey)) {
    Run-Checked 'keytool' @('-genkeypair','-keystore',$debugKey,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=SunPower Demo,O=SunPower,C=IN','-keyalg','RSA','-keysize','2048','-validity','3650')
}
Run-Checked (Join-Path $buildTools 'apksigner.bat') @('sign','--ks',$debugKey,'--ks-pass','pass:android','--key-pass','pass:android','--out',(Join-Path $out 'SunPower-Android-demo.apk'),(Join-Path $out 'aligned.apk'))
Run-Checked (Join-Path $buildTools 'apksigner.bat') @('verify','--verbose',(Join-Path $out 'SunPower-Android-demo.apk'))
Write-Output (Join-Path $out 'SunPower-Android-demo.apk')
