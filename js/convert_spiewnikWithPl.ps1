Add-Type -AssemblyName System.Web

$path    = 'C:\work\spiewnik\data\spiewnik.txt'
$outPath = 'C:\work\spiewnik\data\songs.json'
$sep     = '= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ='
$lines   = Get-Content -Path $path -Encoding UTF8

function Decode($s) { [System.Web.HttpUtility]::HtmlDecode($s) }

function Transliterate($s) {
    $plChars = [char[]]@(0x105,0x107,0x119,0x142,0x144,0xF3,0x15B,0x17A,0x17C,
                         0x104,0x106,0x118,0x141,0x143,0xD3,0x15A,0x179,0x17B)
    $enChars = 'a','c','e','l','n','o','s','z','z','A','C','E','L','N','O','S','Z','Z'
    $sb = [System.Text.StringBuilder]::new($s.Length)
    foreach ($ch in $s.ToCharArray()) {
        $idx = [Array]::IndexOf($plChars, $ch)
        if ($idx -ge 0) { [void]$sb.Append($enChars[$idx]) }
        else             { [void]$sb.Append($ch) }
    }
    $sb.ToString()
}

$songs  = [System.Collections.Generic.List[object]]::new()
$state  = 0
$idCnt  = 1
$curTit = ''
$curAut = ''
$cLines = [System.Collections.Generic.List[string]]::new()

foreach ($rawLine in $lines) {
    $line  = Decode $rawLine
    $isSep = ($line.TrimEnd() -eq $sep)
    if ($isSep) {
        if ($state -eq 0) {
            $state = 1
        } elseif ($state -eq 2) {
            $state = 3
            $cLines = [System.Collections.Generic.List[string]]::new()
        } elseif ($state -eq 3) {
            # flush current song
            while ($cLines.Count -gt 0 -and $cLines[$cLines.Count-1].TrimEnd() -eq '') { $cLines.RemoveAt($cLines.Count-1) }
            while ($cLines.Count -gt 0 -and $cLines[0].TrimEnd() -eq '') { $cLines.RemoveAt(0) }
            # wyciągnij URL:: z ostatnich linii contentu
            $curUrl = ''
            for ($ui = $cLines.Count - 1; $ui -ge 0; $ui--) {
                if ($cLines[$ui].TrimEnd() -eq '') { continue }
                if ($cLines[$ui] -match '^URL::(.+)$') {
                    $curUrl = $Matches[1].Trim()
                    $cLines.RemoveAt($ui)
                    while ($cLines.Count -gt 0 -and $cLines[$cLines.Count-1].TrimEnd() -eq '') { $cLines.RemoveAt($cLines.Count-1) }
                }
                break
            }
            $obj = [ordered]@{
                id        = "seed-$idCnt"
                title     = $curTit
                author    = $curAut
                category  = 'piosenka'
                content   = ($cLines -join "`n")
                createdAt = '2026-04-01T08:00:00.000Z'
                updatedAt = '2026-04-01T08:00:00.000Z'
            }
            if ($curUrl -ne '') { $obj['url'] = $curUrl }
            $songs.Add([PSCustomObject]$obj)
            $idCnt++
            $state = 1; $curTit = ''; $curAut = ''
            $cLines = [System.Collections.Generic.List[string]]::new()
        }
    } elseif ($state -eq 1) {
        if ($line -match '^TITLE: (.+)$') {
            $tl = $Matches[1].Trim()
            $di = $tl.IndexOf(' - ')
            if ($di -ge 0) { $curTit = $tl.Substring(0,$di).Trim(); $curAut = $tl.Substring($di+3).Trim() }
            else            { $curTit = $tl; $curAut = '' }
        }
        $state = 2
    } elseif ($state -eq 3) {
        $cLines.Add($line)
    }
}

# ostatnia piosenka
if ($state -eq 3 -and $cLines.Count -gt 0) {
    while ($cLines.Count -gt 0 -and $cLines[$cLines.Count-1].TrimEnd() -eq '') { $cLines.RemoveAt($cLines.Count-1) }
    while ($cLines.Count -gt 0 -and $cLines[0].TrimEnd() -eq '') { $cLines.RemoveAt(0) }
    # wyciągnij URL:: z ostatnich linii contentu
    $curUrl = ''
    for ($ui = $cLines.Count - 1; $ui -ge 0; $ui--) {
        if ($cLines[$ui].TrimEnd() -eq '') { continue }
        if ($cLines[$ui] -match '^URL::(.+)$') {
            $curUrl = $Matches[1].Trim()
            $cLines.RemoveAt($ui)
            while ($cLines.Count -gt 0 -and $cLines[$cLines.Count-1].TrimEnd() -eq '') { $cLines.RemoveAt($cLines.Count-1) }
        }
        break
    }
    $obj = [ordered]@{
        id        = "seed-$idCnt"
        title     = Transliterate $curTit
        author    = Transliterate $curAut
        category  = 'piosenka'
        content   = Transliterate ($cLines -join "`n")
        createdAt = '2026-04-01T08:00:00.000Z'
        updatedAt = '2026-04-01T08:00:00.000Z'
    }
    if ($curUrl -ne '') { $obj['url'] = $curUrl }
    $songs.Add([PSCustomObject]$obj)
}

$json = $songs | ConvertTo-Json -Depth 10
$json = $json -replace '":  "', '": "' -replace '    \{', '  {' -replace '        "', '    "'
Set-Content -Path $outPath -Value $json -Encoding UTF8
Write-Host "Converted: $($songs.Count) songs -> $outPath"
