# ArtsIT architecture literature audit

## 1. Executive assessment

The current architectural bibliography is **basically sufficient but missing a
small number of references**. More precisely, the two existing sources are
correct, authoritative, and appropriately used:

- Bass, Clements, and Kazman provide the contemporary software-architecture
  basis for treating modifiability as a quality attribute affected by
  architectural decisions.
- Parnas provides the foundational information-hiding and modular-decomposition
  basis for containing decisions likely to change.

One focused addition is warranted. The manuscript evaluates extensibility
through a concrete second activity and a repository-history change scenario,
but it does not currently anchor scenario-based architectural modifiability
analysis in the research literature. Bengtsson et al.'s Architecture-Level
Modifiability Analysis (ALMA) is the strongest minimal addition because it is a
peer-reviewed journal article specifically about evaluating modifiability
through change scenarios.

The paper does not need a broad survey of hexagonal architecture, clean
architecture, dependency inversion, technical debt, software product lines, or
cross-platform framework selection. The implementation uses ports and adapters
as a descriptive vocabulary, but it does not claim conformance to a named
architectural pattern. Its platform result is also an artifact-specific build
result, not a comparative evaluation of cross-platform development frameworks.

Most of the manuscript's architectural statements are implementation
descriptions or repository-specific evaluation findings. They should continue
to be supported by code, tests, boundary checks, repository history,
change-surface artifacts, and build evidence rather than external citations.
In particular, no architecture source can establish that the PLP controller
remained unchanged, that 98 tests passed, or that the application compiled on
three targets.

There is one domain-specific motivational assertion that architecture
literature cannot substantiate: the Abstract and Introduction say that
music-learning applications are frequently or commonly organized around one
practice protocol. A generic architecture citation would overstate its
support. The statement is not used as empirical evidence for the repository
result, so this audit leaves it unchanged. If the authors later decide that
the frequency claim itself must be externally demonstrated, it requires a
separate review of music-technology systems, which is outside this focused
architecture-literature task.

The source file contains a legacy block between `\iffalse` and `\fi`. It is
excluded from the compiled manuscript and was therefore read for context but
not treated as current manuscript argumentation.

## 2. Claim audit

Assessment labels mean:

- **adequately supported**: the current literature is appropriate and no
  addition is needed;
- **partially supported**: a relevant basis exists, but one precise addition
  or a clear evidence boundary is needed;
- **unsupported by architecture literature**: no current architecture source
  establishes the claim, and adding a generic citation would be misleading;
- **implementation evidence**: the claim is properly supported by the
  repository rather than external literature;
- **author interpretation/design criterion**: the statement is a declared
  design goal, methodological choice, or bounded interpretation of presented
  evidence.

| Manuscript section | Architectural claim | Current support | Assessment | Recommended action |
|---|---|---|---|---|
| Abstract | Music-learning applications are frequently organized around one activity, making later pedagogical extension expensive and difficult to validate. | No architecture citation; the manuscript's own migration motivates the problem but does not establish field-wide frequency. | Unsupported by architecture literature for the domain-frequency wording. | Do not attach a generic architecture source. Leave unchanged under the frozen-text rule; a future domain survey would be a separate task. |
| Abstract | The architecture separates a bounded lifecycle and reusable capabilities from activity-specific pedagogical logic. | Implementation, boundary audit, diagrams, and deterministic tests. | Implementation evidence. | No external citation. |
| Abstract | Two contrasting activities were instantiated with localized modification while retaining cross-platform maintainability. | Two controllers and tests; change-surface artifacts; web, Android, and iOS build evidence. | Implementation evidence. | No external citation. |
| Introduction, software challenge paragraph | Timing, audio, pitch, persistence, and view transitions can become interwoven with one pedagogical sequence, so a second activity can require restructuring. | Parnas and Bass explain general change propagation and modifiability, but they do not establish prevalence in music-learning applications. | Partially supported as a general software concern; domain prevalence remains an author observation. | Do not citation-dump. Existing following paragraph supplies the general architectural rationale. |
| Introduction, software challenge paragraph | A useful architecture should preserve activity-specific pedagogy while making ownership, termination, and targets consistent. | Declared design criterion, then realized by the implementation. | Author interpretation/design criterion plus implementation evidence. | No external citation. |
| Introduction, architecture paragraph | Modifiability is a quality attribute shaped by architectural decisions rather than component count alone. | `Bass21`, especially the quality-attribute, modifiability, interface, mobile-system, and architecture-evaluation material. | Adequately supported. | Retain `Bass21` at the sentence. Do not extend it to repository-specific claims. |
| Introduction, architecture paragraph | Decisions likely to change should be hidden behind module interfaces so that change need not propagate. | `Parnas72`, which explicitly contrasts decompositions and argues for hiding difficult or changeable design decisions. | Adequately supported. | Retain `Parnas72` at the sentence. |
| Introduction, architecture paragraph | A concrete change scenario is a suitable way to make a modifiability argument more specific than modular naming. | No scenario-analysis source; repository evidence supplies the realized outcome. | Partially supported. | Add `Bengtsson04` immediately after “repository-history change scenario.” The citation supports the scenario-based modifiability method, not the repository result. |
| Introduction, research question and contributions | A bounded lifecycle and capability architecture can be investigated through two contrasting vertical slices and a frozen-core comparison. | Repository implementation, tests, reports, and history. | Implementation evidence and research design. | No external citation. |
| User-Facing Activities | The two routes differ materially in temporal driver and feedback policy, testing whether shared lifecycle code can avoid absorbing pedagogy. | Controllers, types, activity comparison, tests, and UI composition. | Implementation evidence and research design. | No external citation. |
| Architecture, Design Goals | Shared code should contain only common lifecycle/capabilities; resource starters should own cancellation; views should present state without owning resources. | Explicit project design requirements and implementation boundaries. | Author interpretation/design criterion plus implementation evidence. | No external citation. These are not presented as universal laws. |
| Architecture, dependency figure | Controllers depend on narrow ports, adapters remain at the boundary, and transitions remain activity-specific. | Source imports, `ActivityContext`, adapters, controller code, and executable boundary check. | Implementation evidence. | No external citation; do not label the design “hexagonal architecture.” |
| Architecture, Bounded Lifecycle | A discriminated lifecycle makes terminal outcomes explicit and confines activity-specific state to the running variant. | Typed contracts and lifecycle tests. | Implementation evidence. | No external citation. |
| Architecture, Session Admission | Single admission and one cancellation boundary prevent active activities from competing for resources. | `ActivitySessionService`, route composition, and supersession tests. | Implementation evidence with a bounded design inference. | No external citation. |
| Architecture, Capability Ports and Ownership | Controllers acquire and release clock, pitch, audio, and persistence resources on all terminal paths; cancellation is idempotent. | Controller code and exactly-once cleanup tests. | Implementation evidence. | No external citation. Literature cannot prove the implemented cleanup paths. |
| Architecture, Capability Ports and Ownership | Centralized ownership matters when learner, route, and operating-system lifecycle events occur close together. | Mobile lifecycle is covered generally by `Bass21`; the concrete risk and response are implementation-specific. | Adequately contextualized by existing source and tests. | No additional citation; adding a separate mobile source would not improve the claim. |
| Architecture, Typed Musical Domain | One `NoteTarget` prevents independent written-to-sounding conversions in views and controllers. | Typed musical-domain implementation and instrument audit. | Implementation evidence. | No architecture citation. |
| Architecture, Bounded Results and Persistence | Common envelopes are shared while activity-specific persistence remains at the adapter boundary; telemetry is bounded. | Contracts, Firebase adapter, persistence tests, and reports. | Implementation evidence. | No external citation. |
| Two Architectural Instantiations | PLP and target intonation are contrasting state models within one lifecycle, rather than variants of one state machine. | Controller traces, types, tests, and lifecycle figure. | Implementation evidence and bounded interpretation. | No external citation. |
| Pure Target-Relative Evaluation | The evaluator is independent of framework, DOM, audio, persistence, and wall-clock dependencies. | Imports, source, fake-port tests, and injected timestamps. | Implementation evidence. | No external citation. |
| Technical Evaluation, Questions and Method | Change locality is assessed from a frozen comparison point through a classified realized change. | Repository history and machine-readable change-surface evidence. | Implementation evidence; ALMA supplies only the broader scenario-based precedent. | Cite `Bengtsson04` once in the Introduction, where the methodological premise is stated. Do not imply that ALMA prescribes Git line classification. |
| Technical Evaluation, Behavioral and Boundary Results | Dependency boundaries, resource ownership, and platform composition passed deterministic checks. | Tests, executable audit, and build reports. | Implementation evidence. | No external citation. |
| Technical Evaluation, Change-Surface Results | Line counts alone do not establish extensibility; locality is interpreted together with history, unchanged content, traces, and boundary checks. | Author's explicitly bounded triangulation of repository evidence. | Author interpretation/design criterion, consistent with scenario-based modifiability analysis. | No further citation. ALMA does not validate line counts or this repository. |
| Discussion, central claim | The bounded architecture accommodated two temporal and functional protocols while preserving PLP and minimally extending shared capabilities. | Implementation, tests, history, and change-surface report. | Implementation evidence. | No external citation. |
| Discussion, localized pedagogical change | New pedagogical policy stayed in the new activity module; shared changes were common capabilities; PLP semantics remained intact. | File classification, hashes, controller traces, and boundary audit. | Implementation evidence. | No external citation. |
| Discussion, locality | Locality improves reviewability and reproducibility because the evaluator, traces, and changed files can be inspected independently. | The following sentences state the concrete inspection and replay mechanisms; Parnas supports comprehensibility but not the full reproducibility claim. | Bounded author interpretation grounded in the artifact. | Do not over-attribute this combined claim to Parnas. |
| Discussion, policy/infrastructure separation | A common lifecycle can centralize cancellation/results while controllers preserve visible pedagogical sequence. | Implemented lifecycle, controller separation, and tests. | Implementation evidence and design interpretation. | No external citation. |
| Discussion, Cross-Platform Maintainability | Framework-independent controllers allow deterministic evidence before packaging and confine native verification to composition boundaries. | Controller imports, fake-port tests, and platform builds. | Implementation evidence. | Do not cite cross-platform performance or framework-selection studies; they evaluate different questions. |
| Limitations | Two activities in one application do not establish arbitrary extensibility, toolkit maturity, or framework adoption. | Explicit evidence boundary and implementation scope. | Author interpretation/design criterion. | No external taxonomy is needed because the manuscript avoids claiming a named framework. |
| Conclusion | Tests, audits, repository history, and platform builds provide convergent evidence for modification locality, ownership, reproducibility, and cross-platform maintainability. | Direct artifact evidence mapped in `artsit_manuscript_evidence_map.md`. | Implementation evidence. | No external citation. |

### Claim-audit conclusion

The only architecture-literature gap that should be repaired in the current
text is the methodological premise behind the repository-history change
scenario. The central result remains an empirical claim about this repository,
not a claim conferred by ALMA or any other external source.

## 3. Verified existing architectural references

### 3.1 Bass, Clements, and Kazman

**Verified citation**

Len Bass, Paul Clements, and Rick Kazman. *Software Architecture in
Practice*. 4th ed. Addison-Wesley Professional, 2021. Print ISBN-13
978-0-13-688609-9.

**Source type and importance**

Authoritative contemporary textbook; highly influential architecture
reference. It is not presented as a peer-reviewed journal article.

**Verification**

- The [official Pearson catalogue
  record](https://www.pearson.com/en-ca/subject-catalog/p/software-architecture-in-practice/P200000000111/9780136886099)
  confirms the exact title, fourth edition, author order, Addison-Wesley
  Professional imprint, 15 December 2021 publication date, and print ISBN.
- The same publisher record's table of contents explicitly includes quality
  attributes, quality-attribute scenarios, Chapter 8 on modifiability,
  software interfaces, mobile-system lifecycle, architecture evaluation, and
  managing architecture debt.

**Current manuscript location**

Introduction, immediately after the sentence treating modifiability as a
quality attribute shaped by architectural decisions.

**Assessment**

The current bibliography year `(2021)` is correct under the publisher's
explicit publication date, even though the catalogue also displays a 2022
copyright notice. The author order, title, edition, and publisher are correct.
The citation supports the quality-attribute and architecture-decision claim.
It does not establish the repository's change locality, test results, or
cross-platform builds, and the manuscript does not use it for those findings.

### 3.2 Parnas

**Verified citation**

D. L. Parnas. “On the Criteria to Be Used in Decomposing Systems into
Modules.” *Communications of the ACM* 15(12), 1053-1058 (1972).
<https://doi.org/10.1145/361598.361623>.

**Source type and importance**

Canonical foundational journal paper on modular decomposition and information
hiding.

**Verification**

- The [ACM DOI record](https://doi.org/10.1145/361598.361623) and
  [Crossref metadata
  record](https://api.crossref.org/works/10.1145%2F361598.361623) confirm D. L.
  Parnas, the exact title, *Communications of the ACM*, volume 15, issue 12,
  pages 1053-1058, December 1972, ACM as publisher, and the DOI.
- The paper's abstract and decomposition example explicitly concern
  flexibility and comprehensibility, and its information-hiding decomposition
  assigns modules around difficult design decisions or decisions likely to
  change.

**Current manuscript location**

Introduction, immediately after the sentence explaining that decisions likely
to change are placed behind module interfaces to prevent propagation.

**Assessment**

The inline bibliography entry is bibliographically correct. The manuscript
uses the source narrowly and accurately. It does not claim that Parnas
proposed this repository's lifecycle, capability ports, or change-surface
method.

## 4. Recommended additions

### 4.1 Add Bengtsson et al. (ALMA)

**Complete verified reference**

PerOlof Bengtsson, Nico Lassing, Jan Bosch, and Hans van Vliet.
“Architecture-Level Modifiability Analysis (ALMA).” *Journal of Systems and
Software* 69(1-2), 129-147 (2004).
<https://doi.org/10.1016/S0164-1212(03)00080-3>.

**Authoritative records**

- [Elsevier ScienceDirect publisher
  record](https://www.sciencedirect.com/science/article/pii/S0164121203000803)
- [Crossref metadata
  record](https://api.crossref.org/works/10.1016%2FS0164-1212%2803%2900080-3)
- [University of Groningen research
  record](https://research.rug.nl/en/publications/architecture-level-modifiability-analysis-alma/)

These records agree on the exact author order, title, year, journal, volume,
combined issue, page range, and DOI. The university record identifies the work
as a peer-reviewed academic article.

**Source type and importance**

Peer-reviewed journal article; highly influential and narrowly relevant to
scenario-based architecture-level modifiability analysis.

**Why it is important**

ALMA explicitly organizes modifiability analysis around goal selection,
architecture description, change-scenario elicitation, change-scenario
evaluation, and interpretation. That is the closest scholarly precedent for
the manuscript's use of a concrete second activity as a change scenario and
its interpretation of the realized change surface. It is more precise for
this purpose than adding a general architecture-evaluation textbook or a
collection of pattern references.

**Exact claim supported**

Scenario-based evaluation is an established way to analyze architectural
modifiability. ALMA does not support the manuscript's repository-specific
outcome, its line counts, or the claim that PLP remained unchanged.

**Exact manuscript location**

Introduction, in the sentence:

> Our evaluation makes them concrete through a second activity and a
> repository-history change scenario rather than inferring extensibility from
> the presence of reusable interface components.

Insert `\cite{Bengtsson04}` immediately after “repository-history change
scenario,” so the citation cannot be read as establishing the realized
repository result.

**Wording change required**

None.

## 5. Sources considered but rejected

The following sources are real and were verified, but they should not be added
to the manuscript.

### 5.1 Kazman et al., SAAM

R. Kazman, L. Bass, G. Abowd, and M. Webb. “SAAM: A Method for Analyzing
the Properties of Software Architectures.” In *Proceedings of the 16th
International Conference on Software Engineering*, pp. 81-90. IEEE Computer
Society Press (1994). <https://doi.org/10.1109/ICSE.1994.296768>.

Type: peer-reviewed conference paper; foundational.

Verification: [IEEE Xplore](https://ieeexplore.ieee.org/document/296768/),
[Crossref](https://api.crossref.org/works/10.1109%2FICSE.1994.296768), and
[DBLP](https://dblp.org/rec/conf/icse/KazmanBWA94).

Decision: **considered but not added**. SAAM is canonical and relevant to
scenario-based architecture evaluation, but ALMA is later, peer-reviewed at
journal length, and focused specifically on modifiability. Adding both would
increase citation density without strengthening the narrow support needed.

### 5.2 Parnas, extension and contraction

D. L. Parnas. “Designing Software for Ease of Extension and Contraction.”
*IEEE Transactions on Software Engineering* SE-5(2), 128-138 (1979).
<https://doi.org/10.1109/TSE.1979.234169>.

Type: peer-reviewed foundational journal paper; foundational.

Verification: [IEEE DOI](https://doi.org/10.1109/TSE.1979.234169),
[Crossref](https://api.crossref.org/works/10.1109%2FTSE.1979.234169), and the
[McMaster University research
record](https://experts.mcmaster.ca/scholarly-works/2169069).

Decision: **considered but not added**. This paper is directly relevant to
extension, contraction, the uses relation, and design for change. However,
`Parnas72` already supplies the manuscript's information-hiding principle,
while `Bass21` covers modern modifiability and `Bengtsson04` covers its
evaluation. A second Parnas citation would be accurate but duplicative.

### 5.3 Architecture Tradeoff Analysis Method

R. Kazman, M. H. Klein, M. R. Barbacci, T. A. Longstaff, H. F. Lipson, and
J. Carriere. *The Architecture Tradeoff Analysis Method*.
CMU/SEI-98-TR-008. Software Engineering Institute, Carnegie Mellon University
(1998).

Type: authoritative technical report; highly influential.

Verification: [official SEI report
record](https://insights.sei.cmu.edu/library/the-architecture-tradeoff-analysis-method/).

Decision: **rejected**. ATAM evaluates tradeoffs among multiple competing
quality attributes. The manuscript does not conduct an ATAM, build a utility
tree, or analyze quality-attribute tradeoffs. Citing it would imply a broader
evaluation than was performed.

### 5.4 Sangal et al., dependency models

N. Sangal, E. Jordan, V. Sinha, and D. Jackson. “Using Dependency Models to
Manage Complex Software Architecture.” In *Proceedings of the 20th ACM
SIGPLAN Conference on Object-Oriented Programming, Systems, Languages, and
Applications*, pp. 167-176 (2005).
<https://doi.org/10.1145/1094811.1094824>.

Type: peer-reviewed conference paper; narrowly relevant to dependency
conformance and evolution.

Verification: [ACM DOI
record](https://doi.org/10.1145/1094811.1094824) and
[DBLP](https://dblp.org/rec/conf/oopsla/SangalJSJ05).

Decision: **rejected**. The manuscript uses a small executable import-boundary
check, not a dependency structure matrix, design-rule model, or longitudinal
architecture-conformance analysis. The similar vocabulary is not enough to
justify the citation.

### 5.5 ISO/IEC 25010:2023

International Organization for Standardization. *ISO/IEC 25010:2023, Systems
and Software Engineering - Systems and Software Quality Requirements and
Evaluation (SQuaRE) - Product Quality Model*. 2nd ed. ISO (2023).

Type: international standard; authoritative reference model.

Verification: [official ISO
record](https://www.iso.org/standard/78176.html), which confirms the title,
reference number, second edition, November 2023 publication, and product
quality model.

Decision: **rejected**. The manuscript does not claim a SQuaRE-conformant
quality model or standardized maintainability measurement. Adding the standard
would make the evaluation appear more formal or comprehensive than it is.

### 5.6 Cockburn, Hexagonal Architecture

A. Cockburn. *Hexagonal Architecture*. HaT Technical Report 2005.02,
version 0.9 (4 September 2005).

Type: practitioner technical report/pattern article; foundational practitioner
description, not a peer-reviewed publication.

Verification: [author's original
record](https://alistair.cockburn.us/hexagonal-architecture).

Decision: **rejected**. The manuscript's ports and adapters are accurately
described at implementation level, but the paper does not need to claim
conformance to hexagonal architecture. The source also does not meet the
preferred scholarly-source standard when stronger literature already supports
the actual claims.

### 5.7 Rieger and Majchrzak, cross-platform evaluation

C. Rieger and T. A. Majchrzak. “Towards the Definitive Evaluation Framework
for Cross-Platform App Development Approaches.” *Journal of Systems and
Software* 153, 175-199 (2019).
<https://doi.org/10.1016/j.jss.2019.04.001>.

Type: peer-reviewed journal article; recent and narrowly relevant to comparing
cross-platform development approaches.

Verification: [Elsevier ScienceDirect publisher
record](https://www.sciencedirect.com/science/article/pii/S0164121219300743).

Decision: **rejected**. The paper evaluates and compares cross-platform
frameworks using a multi-criteria framework. The ArtsIT manuscript instead
reports whether one application still builds and composes on its three stated
targets. It makes no framework-selection or comparative productivity claim.

### 5.8 Biørn-Hansen et al., cross-platform performance

A. Biørn-Hansen, C. Rieger, T.-M. Grønli, T. A. Majchrzak, and G. Ghinea.
“An Empirical Investigation of Performance Overhead in Cross-Platform Mobile
Development Frameworks.” *Empirical Software Engineering* 25, 2997-3040
(2020). <https://doi.org/10.1007/s10664-020-09827-6>.

Type: peer-reviewed journal article; recent empirical cross-platform research.

Verification: [Springer Nature publisher
record](https://link.springer.com/article/10.1007/s10664-020-09827-6).

Decision: **rejected**. This study concerns runtime performance overhead
relative to native applications. The manuscript explicitly does not report
runtime performance, detector latency, or comparative framework performance.
The source is authoritative but supports a different claim.

### 5.9 Kruchten, Nord, and Ozkaya, technical debt

P. Kruchten, R. L. Nord, and I. Ozkaya. “Technical Debt: From Metaphor to
Theory and Practice.” *IEEE Software* 29(6), 18-21 (2012).
<https://doi.org/10.1109/MS.2012.167>.

Type: peer-reviewed magazine article/guest editors' introduction; highly
influential technical-debt source.

Verification: [official SEI
record](https://www.sei.cmu.edu/library/technical-debt-from-metaphor-to-theory-and-practice/)
and [IEEE DOI](https://doi.org/10.1109/MS.2012.167).

Decision: **rejected**. The manuscript does not characterize the pre-migration
design as technical debt or measure debt, rework cost, or architectural
erosion. Introducing the metaphor would change the narrative and is not needed
to support modification locality.

## 6. Final minimal bibliography recommendation

The smallest strong architectural bibliography is:

1. Bass, Clements, and Kazman (2021) for contemporary software architecture,
   quality attributes, modifiability, interfaces, mobile lifecycle concerns,
   and architecture evaluation.
2. Parnas (1972) for foundational information hiding, modular decomposition,
   flexibility, comprehensibility, and containment of likely change.
3. Bengtsson, Lassing, Bosch, and van Vliet (2004) for peer-reviewed,
   scenario-based architecture-level modifiability analysis.

This three-source set is deliberately compact. It covers the manuscript's
general architectural premises while leaving its empirical findings attached
to the artifact evidence that actually demonstrates them.
