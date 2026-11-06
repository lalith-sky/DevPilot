$gitignorePath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.gitignore'))
$content = Get-Content -LiteralPath $gitignorePath -Raw
if ($content -notmatch '\*\.tsbuildinfo') {
    Add-Content -LiteralPath $gitignorePath -Value "`r`n# TypeScript build metadata`r`n*.tsbuildinfo" -Encoding utf8
}
