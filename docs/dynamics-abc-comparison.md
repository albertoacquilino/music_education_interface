# Comparison-only A/B/C listening profiles

Profile C is now the selected production calibration. A/B remain frozen
comparison fixtures only; selecting them here does not change the application.
Run node scripts/compare-expressive-dynamics.cjs; open http://127.0.0.1:4210.
Use the Calibration selector; it stops current audio, renders/cache-selects the
new profile and replaces the clips without reloading the page or rebuilding.
Actual levels are primary; RMS-matched and optional speaker modes are secondary.
Only one clip plays at a time. Downloads contain the profile letter.

## Exact settings

All use identical committed sources, two-second 48 kHz stereo renders at rate=1,
the same .2 s tail fade, and a 5 ms entry ramp for mf/p. Forte is unfiltered at
gain=1 in all profiles. Shelf pivots are identical across A/B/C:
max(floor, sounding f0 × harmonic), capped at 19200 Hz.

| Instrument | floor/harmonic | A mf/p shelf dB | B mf/p shelf dB | C mf/p nominal shelf dB |
|---|---|---|---|---|
| Trumpet | 1000 / 3 | -3 / -7 | -1.5 / -3.5 | -2.25 / -5.25 |
| Clarinet | 1200 / 4 | -2 / -5 | -1 / -2.5 | -1.5 / -3.75 |
| Oboe | 1600 / 4 | -2.5 / -6 | -1.25 / -3 | -1.875 / -4.5 |
| Flute | 900 / 2.5 | -1.5 / -4 | -.75 / -2 | -1.125 / -3 |

A uses exact original gains mf=.4, p=.15, without low-register shelf protection.
B imports the current profile directly: mf=10^(-3.5/20), p=10^(-7.5/20);
its shelf depth multiplier is d=min(1,max(.65,f0/440)).
C's actual shelf dB is the arithmetic mean of A and B at the note's f0,
equivalently its nominal depth times (2+d)/3. C renders at unit gain, measures
EQ contribution, then applies gain=f_RMS*10^(target_dB/20)/filtered_RMS.
Targets are -6 dB mf / -12 dB p, measured over .25–.75 seconds, both channels.
These are excerpt-specific RMS targets, not LUFS, acoustic SPL or measured
subjective loudness. Production C uses the same compensation contract at the
session's selected A4; A/B and comparison-only matching/speaker modes are excluded.

## Browser measurements (same stereo metric across A/B/C)

| Instrument: low / middle / high | A mf | A p | B mf | B p |
|---|---|---|---|---|
| Trumpet F3s/A4/C6 | -9.16/-8.68/-8.02 | -19.08/-18.01/-16.63 | -3.91/-3.84/-3.53 | -8.42/-8.25/-7.58 |
| Clarinet E3/D5/C7 | -8.21/-8.09/-7.98 | -17.10/-16.79/-16.52 | -3.58/-3.57/-3.51 | -7.71/-7.66/-7.52 |
| Oboe B3/E5/G6s | -8.61/-8.09/-7.98 | -17.97/-16.81/-16.52 | -3.72/-3.57/-3.51 | -8.01/-7.66/-7.52 |
| Flute B3/F5/B6 | -8.10/-8.27/-8.00 | -16.84/-17.24/-16.59 | -3.55/-3.66/-3.52 | -7.62/-7.91/-7.55 |

C measured -6.00/-12.00 on every note. Its linear gains ranged .50196–.55026 mf,
.25213–.30906 p. Exact per-note gain/EQ and measured output are expandable on
each clip and in the accumulated validation report below the notes.
Across all profiles, forte RMS/peak matched exactly and raw maximum peak was
.96667. Every clip has 96000 frames. Speaker versions retain the existing
comparison-only common headroom scaling, and RMS-matching only attenuates.

Check parameter regressions with node scripts/check-dynamics-comparison.cjs.
The page retains validation reports from all visited profiles for cross-checking.
Physical smartphone audibility, musical realism and freedom from audible
artifacts require listening; automated amplitude checks alone do not prove them.
