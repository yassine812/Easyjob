Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies @([System.Speech.Synthesis.SpeechSynthesizer].Assembly.Location, "System.Collections", "System.Threading") -TypeDefinition @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Speech.Synthesis;
public class PitchTiming16 {
    public static void Generate(string text, string audio, string timing) {
        var rows = new List<string>();
        using (var speech = new SpeechSynthesizer()) {
            speech.SelectVoice("Microsoft Paul");
            speech.Rate = 0;
            speech.SetOutputToWaveFile(audio, new System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, System.Speech.AudioFormat.AudioBitsPerSample.Sixteen, System.Speech.AudioFormat.AudioChannel.Mono));
            speech.SpeakProgress += (sender, e) => {
                lock(rows) rows.Add(e.AudioPosition.TotalSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture) + "\t" + e.CharacterPosition + "\t" + e.CharacterCount);
            };
            speech.Speak(text);
        }
        File.WriteAllLines(timing, rows);
    }
}
'@
[PitchTiming16]::Generate((Get-Content -LiteralPath "$PSScriptRoot\easyjob-pitch-fr.txt" -Raw -Encoding UTF8), "$PSScriptRoot\easyjob-pitch-fr-16k.wav", "$PSScriptRoot\narration-timing-16k.tsv")



