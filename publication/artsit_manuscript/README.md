# ArtsIT manuscript

The revised regular-paper source is `samplepaper.tex`. It uses the installed
Springer LNCS class and an inline `thebibliography`; no BibTeX step is needed.

Compile the vector figures first, then the paper:

```sh
cd publication/artsit_manuscript/figures
latexmk -pdf -interaction=nonstopmode -halt-on-error activity-architecture.tex
latexmk -pdf -interaction=nonstopmode -halt-on-error activity-lifecycles.tex

cd ..
latexmk -pdf -interaction=nonstopmode -halt-on-error samplepaper.tex
```

The source deliberately keeps author metadata anonymous. Before submission,
resolve the blockers in `publication/artsit_manuscript_gap_list.md`.
