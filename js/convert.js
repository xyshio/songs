Add-Type -AssemblyName System.Web
$path    = 'C:\work\spiewnik.txt'
$outPath = 'C:\work\spiewnik.json'
$sep     = '= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = ='
$lines   = Get-Content -Path $path -Encoding UTF8

function Decode($s) { [System.Web.HttpUtility]::HtmlDecode($s) }

function Transliterate($s) {
    $map = @{
        'ą'='a'; 'ć'='c'; 'ę'='e'; 'ł'='l'; 'ń'='n'; 'ó'='o'; 'ś'='s'; 'ź'='z'; 'ż'='z'
        'Ą'='A'; 'Ć'='C'; 'Ę'='E'; 'Ł'='L'; 'Ń'='N'; 'Ó'='O'; 'Ś'='S'; 'Ź'='Z'; 'Ż'='Z'
    }
    $sb = [System.Text.StringBuilder]::new($s.Length)
    foreach ($ch in $s.ToCharArray()) {
        $rep = $map["$ch"]
        if ($rep) { [void]$sb.Append($rep) } else { [void]$sb.Append($ch) }
    }
    $sb.ToString()
}

$songs  = [System.Collections.Generic.List[object]]::new()
$state  = 0
$idCnt  = 1
$curTit = ''
$curAut = ''
$cLines = [System.Collections.Generic.List[string]]::new()

function Flush-Song {
    param($tit,$aut,$cl,$id)
    while ($cl.Count -gt 0 -and $cl[$cl.Count-1].TrimEnd() -eq '') { $cl.RemoveAt($cl.Count-1) }
    while ($cl.Count -gt 0 -and $cl[0].TrimEnd() -eq '') { $cl.RemoveAt(0) }
    [PSCustomObject][ordered]@{
        id        = $id
        title     = Transliterate $tit
        author    = Transliterate $aut
        category  = 'piosenka'
        content   = Transliterate ($cl -join "`n")
        createdAt = '2026-04-01T08:00:00.000Z'
        updatedAt = '2026-04-01T08:00:00.000Z'
    }
}

foreach ($rawLine in $lines) {
    $line  = Decode $rawLine
    $isSep = ($line.TrimEnd() -eq $sep)
    if ($isSep) {
        if     ($state -eq 0) { $state = 1 }
        elseif ($state -eq 2) { $state = 3; $cLines = [System.Collections.Generic.List[string]]::new() }
        elseif ($state -eq 3) {
            $songs.Add((Flush-Song $curTit $curAut $cLines "seed-$idCnt"))
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
if ($state -eq 3 -and $cLines.Count -gt 0) {
    $songs.Add((Flush-Song $curTit $curAut $cLines "seed-$idCnt"))
}

$json = $songs | ConvertTo-Json -Depth 10
$json = $json -replace '":  "', '": "' -replace '    \{', '  {' -replace '        "', '    "'
Set-Content -Path $outPath -Value $json -Encoding UTF8
"Converted: $($songs.Count) songs -> $outPath"