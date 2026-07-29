# ArtsIT Figure 1 design audit

## 1. Current-figure assessment

The previous Figure 1 accurately showed the two mobile-responsive entry
surfaces. It established that both activities could be launched and that their
initial controls differed: Prepare–listen–play exposed instrument, range, and
tempo configuration, while Target intonation explained its explicit-target
task and reference-tone option.

That design was weak as the manuscript's first visual explanation of the
activities. A music-education or instrumental-pedagogy reviewer could not see
what the learner read, heard, fingered, produced, or monitored after pressing
Start. In particular, the entry surfaces did not show:

- the prepare/listen/play temporal sequence;
- musical notation or an activity target;
- instrument-specific fingering during the activity;
- target-relative pitch feedback;
- the stable-hold requirement;
- why the two activities constitute contrasting pedagogical interactions.

The large unoccupied areas in both portrait captures magnified this problem at
publication size: useful controls occupied a relatively small fraction of each
panel, while the activity-specific musical information was absent. The figure
was technically correct but did not prepare a non-architecture reviewer for
the architectural comparison in Figures 2 and 3.

## 2. Available application states

### Prepare–listen–play

Inspection of the implemented view and controller confirmed the following
stable learner-facing states:

- **Configuration:** instrument, tempo, lowest and highest note, and Start.
- **Preparing:** the current beat, Rest phase, selected instrument fingering,
  and generated notation.
- **Listening:** the current beat, Listen phase, the same fingering and
  notation, and controller-triggered reference-tone playback at the start of
  the phase.
- **Playing:** the current beat, Play phase, the fingering and notation, and
  non-gating target-relative pitch feedback.

The active view contains a Rest–Listen–Play status rail, a beat number,
instrument-specific valves or fingering asset, a pitch-status strip, a VexFlow
score, and Stop control. For clarinet and oboe the view loads the typed
target's fingering asset; for trumpet it renders the valve configuration.

The listening state is the strongest single PLP state for Figure 1. It shows
the full three-part phase rail with **Listen** highlighted, the beat, the
clarinet fingering, the written pattern, and the pitch strip labelled
**Listen**. A preparing state would make the preparatory function clear but
would make the reference-model stage less immediately visible. A playing
state would foreground pitch feedback, which would visually blur the
distinction from Target intonation.

### Target intonation

Inspection confirmed the following stable learner-facing states:

- **Configuration:** activity explanation, reference-tone option, and Start.
- **Presenting target:** written target name and notation, target/attempt
  count, and reference-tone status.
- **Awaiting signal:** explicit target plus no-signal feedback.
- **Tracking:** explicit written target, detected frequency, cents from the
  explicit sounding target, target-relative gauge and qualitative indicator,
  feedback band, and stable-hold progress.
- **Attempt result:** stable-hold, timeout, or skip outcome with the permitted
  retry/next/skip controls.

The tracking state is the strongest state for Figure 1 because it displays
both the task specification and the learner's active regulation of pitch. A
controlled in-tolerance state is preferable to a neutral or no-signal state:
the relation between the target, the gauge, the qualitative indicator, and
hold progress is visible without requiring the reader to infer what the
interface would eventually do.

## 3. Options considered

| Option | Strengths | Limitations | Decision |
|---|---|---|---|
| Two entry/configuration screens | Symmetrical; shows launch affordances and configuration | Contains little musical evidence; hides the characteristic learner interactions; leaves large blank areas | Rejected |
| Two full in-session screenshots | Directly compares real learner activity; strongest musical content | The Target intonation mobile state extends beyond one viewport, so either the written target or stable-hold evidence becomes too small or falls below the crop | Retained as the design basis, with a compact same-state composition for panel (b) |
| One entry and one in-session screen | Could preserve instrument/configuration evidence on one side | Creates an asymmetric comparison and risks implying that only one activity has a substantive interaction | Rejected |
| Compact composites for both activities | Could maximize information density | PLP already fits coherently in one viewport; segmenting it would add visual complexity without adding evidence | Rejected for panel (a) |
| One PLP in-session screenshot plus a compact Target intonation same-state composite | Preserves a coherent PLP temporal view; makes the explicit target, tuner, qualitative feedback, and stability progress simultaneously legible; uses comparable portrait panels | Requires transparent disclosure that panel (b) combines unscaled crops | **Selected** |
| Two wide/tablet states | Places Target intonation target and feedback side by side in one viewport | At the final two-column figure width, critical text and phase labels become materially smaller than in the mobile captures | Rejected |

The selected design remains a two-panel figure. It does not reproduce the
dependency graph of Figure 2 or the transition models of Figure 3. It answers
the earlier editorial question: what musical task does the learner perform in
each activity?

## 4. Final design decision

Figure 1 uses two portrait learner-facing panels:

1. a single complete mobile capture of Prepare–listen–play during the clarinet
   **Listen** phase; and
2. a compact composition of unscaled crops from the same controlled Target
   intonation tracking state.

This is the strongest balance of the relevant criteria:

- **Pedagogical clarity:** the left panel visibly joins fingering, notation,
  model listening, and a timed three-part sequence; the right panel visibly
  joins a written target, produced-pitch feedback, and stable holding.
- **Musical content:** both panels contain notation. The left adds
  instrument-specific fingering; the right adds target-relative cents and
  tuning information.
- **Technical accuracy:** both panels are rendered by the implemented
  application using its production controllers, musical-domain services,
  notation presenter, and UI components.
- **Print readability:** the 390-by-760 CSS-pixel captures are stored at
  two-device-pixel resolution. The Target intonation composition removes
  uninformative scrolling distance without resizing individual interface
  elements. Thin rules disclose the crop boundaries.
- **Consistency:** both final panels are portrait, similarly scaled, and
  derived from active mobile application views. Neither includes browser or
  simulator chrome.
- **Narrative fit:** Figure 1 establishes the learner-facing contrast before
  Figure 2 explains dependency direction and Figure 3 explains the
  clock-driven/event-driven transition contrast.

The Target intonation panel is deliberately a compact same-state composition,
not a conceptual mock-up. Its three unscaled regions show the written target
and notation, target-relative gauge, and feedback/stability area. No interface
content was invented, moved within a region, enlarged, or altered.

## 5. Instrument decision

Clarinet is used for Prepare–listen–play.

Repository inspection confirmed that:

- the B-flat clarinet is present in the typed instrument registry;
- its written-note range and sounding transposition are defined;
- complete fingering assets and reference-audio mappings are available;
- the active PLP view renders its target-specific fingering reliably; and
- the existing typed-instrument/asset audit reports the supported instrument
  set without a clarinet exception.

The captured written G4 target therefore uses the real B-flat clarinet domain
definition and fingering asset. The Figure 1 caption identifies the
instrument but does not claim that the screenshot evaluates transposition.

Target intonation uses the B-flat trumpet in the controlled state. Using two
implemented instruments across the figure reinforces that the application is
not tied to one instrument while preserving the clarinet preference for the
PLP panel.

## 6. Screenshot provenance

### Panel (a): Prepare–listen–play

- **Application route:** `/home/exercise`
- **Selected instrument:** B-flat clarinet (`clarinet-bb`)
- **Selected target:** written G4, with the same note as the low and high range
  boundary
- **Activity state:** cycle 1, beat 1, `listening`
- **Relevant configuration:** A4 = 440 Hz; tempo = 80 bpm; four beats per
  phase; accidentals disabled; dynamics disabled; target-relative,
  non-gating pitch display
- **Deterministic method:** the production
  `PrepareListenPlayController` is started through
  `ActivitySessionService`. The production instrument registry and notation
  adapter are retained. In-memory clock, audio, pitch-session, and persistence
  ports replace external resources. Five deterministic clock ticks advance
  the real controller to the first beat of the listening phase. No microphone
  is opened and no audio is played.
- **Source image:**
  `publication/artsit_manuscript/figures/plp-active-clarinet.png`

### Panel (b): Target intonation

- **Application route:** `/home/intonation`
- **Selected instrument:** B-flat trumpet (`trumpet-bb`)
- **Selected target:** written G4; expected sounding F4 at
  349.2282314330039 Hz for A4 = 440 Hz
- **Activity state:** target 1 of 3, attempt 1 of 3, `tracking`
- **Relevant configuration:** reference tone enabled; tolerance = ±10 cents;
  required stable hold = 1,500 ms; maximum spread = 12 cents; minimum valid
  estimates = 4; maximum signal gap = 350 ms
- **Deterministic method:** the production `TargetIntonationController` and
  `IntonationEvaluator` are started through `ActivitySessionService` with the
  production instrument registry and notation adapter. In-memory resource
  ports replace microphone, audio, timers, and persistence. Five voiced
  estimates at 2,000, 2,300, 2,600, 2,900, and 3,200 ms are injected at
  350.0360528521642 Hz, exactly +4 cents from the explicit target. The
  evaluator therefore reports `within-tolerance`, five valid estimates,
  zero wrong-note estimates, and 1,200/1,500 ms (80%) stable progress.
- **Raw source images:**
  `publication/artsit_manuscript/figures/target-intonation-target.png` and
  `publication/artsit_manuscript/figures/target-intonation-feedback.png`
- **Final composed panel:**
  `publication/artsit_manuscript/figures/target-intonation-active.png`
- **Composition:** three unscaled lossless crops from two scroll positions of
  the same live controller state are stacked with two two-pixel grey
  separators. The crops retain the target/notation, gauge/emoji, and
  feedback/stability regions. The narrow in-app scroll indicator is excluded.

The reproducible capture and composition source is:
`publication/artsit_manuscript/figures/capture-figure1.mjs`.

The controlled estimates are test inputs to the implemented evaluator. They
are not presented as microphone measurements, detector-accuracy evidence,
latency evidence, or acoustic validation.

## 7. Final caption and alt text

### Caption

Representative learner-facing states of the two activities. (a) In
Prepare–listen–play, a B-flat clarinet learner uses the Rest interval to
prepare the displayed fingering, listens to a reference tone, and then plays
the written pattern; the Listen phase is shown. (b) In Target intonation, a
B-flat trumpet learner produces the sounding pitch associated with an
explicit written G4 target and receives target-relative tuning and stable-hold
feedback. Panel (b) combines unscaled crops of one controlled active state to
retain legibility at print size.

### Proposed alt text

Two learner-facing activity panels. Left: a clarinet fingering diagram and
notated pattern appear beside a Rest–Listen–Play phase rail with Listen
highlighted. Right: written G4 notation is paired with a target-centred tuner,
a smiling in-tolerance indicator, a 350.0 Hz and +4.0 cents reading, and an
80% stable-hold bar. The left activity follows a timed model-and-play
sequence; the right requires a produced pitch to remain stable against an
explicit target.
