# ArtsIT manuscript gap list

This list contains only work that remains after the two-activity implementation,
technical reports, change-surface evidence, manuscript rewrite, figure
replacement, LaTeX compilation, and deterministic repository verification.

## Submission blockers

### 1. Final author and affiliation metadata

The manuscript intentionally contains `Anonymous Author(s)` and a withheld
affiliation. Before the camera-ready submission, replace these placeholders
with the final author order, affiliations, email addresses, and ORCID values,
and confirm the venue's double-blind metadata rules for the review version.

### 2. Stable anonymous artifact location

The Introduction states that an anonymous source artifact and build
instructions accompany review, but the archival URL is deliberately left as a
submission placeholder. Create a stable, reviewer-accessible artifact from the
reported commit history, verify it from a clean environment, and insert its
URL. Restore the public repository URL only when the review policy permits it.

### 3. Parallel-manuscript disclosure and clearance

The separate IJME empirical manuscript must retain all participant findings and
educational interpretations. Before submission, compare the final ArtsIT and
IJME versions for text, figure, dataset, and contribution overlap; make any
required concurrent-submission disclosure to both venues and obtain editorial
clearance where applicable. The current ArtsIT manuscript contains no
participant results, but formal clearance is an external publication step.

## Important limitations

### 1. No controlled acoustic or end-to-end timing characterization

The evaluator and controllers are strongly covered with deterministic
timestamped estimates, but the repository has no completed physical-microphone
or synthetic-waveform study of detector accuracy, acquisition latency,
reference timing, or timeout drift. The manuscript limits its claims
accordingly. A controlled study would materially strengthen the technical
evaluation but is not required to support the narrower architectural result.

### 2. Platform execution evidence is asymmetric

Both routes were rendered on web and in an iOS simulator; Android was
synchronized, built, and unit-tested without an emulator or device launch.
The limitation is stated explicitly. A short Android smoke run would improve
parity, while a physical-device acoustic run belongs with the characterization
work above.

### 3. Architectural generalization is based on two activities in one application

The second activity is meaningfully different and supports the current
extensibility claim. It does not establish arbitrary transfer, independent
adoption, or a stable public extension ecosystem. A third activity or external
replication is future work rather than evidence missing from the current
claim.

### 4. Dependency and native-tooling warnings remain

The verified build retains known dependency-audit findings and existing native
toolchain warnings recorded in the implementation reports. They do not
invalidate the deterministic or build evidence, but security-critical
dependencies and toolchain compatibility should be triaged before a public
release artifact is frozen.

## Optional improvements

### 1. Replace launch screenshots with staged in-activity captures

The current screenshots accurately show both launch surfaces and activity
selection. If a controlled microphone or deterministic demo mode is available
without changing production behavior, an in-progress target-intonation capture
could communicate cents feedback and stability progress more immediately.

### 2. Add an external replication protocol

The evidence map and reports already make the implementation reproducible.
A short, versioned protocol asking another developer to add a third bounded
activity would provide stronger external evidence, but it is beyond the work
needed for internal review.

### 3. Final editorial pass against the definitive ArtsIT template

The manuscript compiles cleanly with the installed LNCS class and has 17 pages
of main text followed by references. Once the definitive submission template,
page-count interpretation, copyright form, and anonymization instructions are
confirmed, perform a final format-only pass without changing the scientific
claims.
