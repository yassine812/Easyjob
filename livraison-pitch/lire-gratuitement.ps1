Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $synth.SelectVoice('Microsoft Paul')
    $synth.Rate = 0
    $synth.SetOutputToWaveFile((Join-Path $PSScriptRoot 'easyjob-pitch-fr-paul.wav'))
    $synth.Speak((Get-Content -LiteralPath (Join-Path $PSScriptRoot 'easyjob-pitch-fr.txt') -Raw -Encoding UTF8))
} finally {
    $synth.Dispose()
}
