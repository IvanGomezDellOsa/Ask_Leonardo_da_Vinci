# Ask Leonardo da Vinci

A retrieval-augmented chatbot in which Leonardo answers **only** from a closed corpus: his
notebooks in J. P. Richter's 1888 English translation ([Project Gutenberg
#5000](https://www.gutenberg.org/ebooks/5000)).

The point of the project is not the character. It is that the character **cannot make things up**,
and that this is measured rather than asserted.

---

## The result

| | without retrieval | with retrieval |
|---|---:|---:|
| quotations attributed to Leonardo that **do not exist** in his notebooks | **96.9%** | **0%** |

Same model, same persona prompt, same temperature. The only variable is whether the system
retrieves passages first.

**This is a count, not an estimate.** Every quoted string in all 120 answers is searched against
the entire corpus, in both languages, with no truncation — the most generous bar available. Two
commands, no API key required:

```bash
npm run evals:citas-corpus -- --entrada baseline-gemini.jsonl
```
```bash
npm run evals:citas-corpus -- --entrada rag-k3-gemini-voz8.jsonl
```

Both runs are committed under `evals/out/`. A number whose evidence is not published is a number
you are asked to trust, which is the thing this project exists to avoid.

---

## What else is measured

| | result | how to check |
|---|---|---|
| Quotation fidelity against the passages the model actually saw | **100%**, 187 quotes, no exceptions | `npm run evals:citas` |
| Topics of the corpus reachable in both languages | **92%** (96% by word count) | `npm run alcance` |
| Retrieval recall at k=3, 5, 8 | 2 failures of 30 | `npm run evals:recall` |
| Gate decisions over the 120-case set | 65 correct / 54 pre-filter leaks / 1 over-abstention | `npm run evals:compuerta` |
| Mechanical guarantees actually firing | see below | `npm run salud` |

Everything in that table runs **offline, with no API key and no cost.** That is deliberate: the
retrieval and gating claims should be checkable by a stranger with a clone and five minutes.

### Numbers this project refuses to headline

End-to-end abstention measures **~88%**, and it is published as a **floor, not a measurement**: it
depends on a regular expression recognising how the model said no, and a regex is not a classifier.
Reading the 12 apparent leaks one by one, only **2** are real and neither invents anything.

An earlier hallucination rate of ~1–2% carries a 95% CI of **[0% — 12.8%]**. The interval is wider
than the figure, so the figure is not used as a claim.

### A known defect, stated rather than hidden

**2 of 92 Spanish quotations carry English function words inside the quotation marks.** Fidelity is
still 100% — the text does match a passage the model saw — but a Spanish reader gets English
mid-sentence. `npm run evals:citas` reports it on every run.

---

## How it works

```
question
   │
   ├─ layer 0   curated list — the ~15 questions the corpus provably cannot answer
   │             (Mona Lisa: one mention in 1.4 MB, and it is Richter saying the
   │              notes never allude to it)
   │
   ├─ layer 1   pre-filter — cosine of the query against the dense index, per language.
   │             It does not judge. It filters.
   │
   └─ layer 2   the model, with the passages in front of it, answers or declines
                 in a single call
```

Then three **mechanical** guarantees, applied in code rather than requested in the prompt:

1. **Every quotation is verified against the passage text.** If it does not match, the answer is
   regenerated. Asking a model not to invent is a hope; checking is a guarantee.
2. **Quotation marks are stripped from anything that still fails.** The problem is not what the
   sentence says, it is that it promises literalness.
3. **Unsourced prose after a refusal is cut.** Measured: that was where invention concentrated.

Retrieval is dense cosine + BM25 fused with RRF, written by hand — no LangChain, no vector
database, no LlamaIndex. The corpus lives in memory. Embeddings are `multilingual-e5-small`, run
locally, so the system depends on no embedding provider's quota.

**Spanish queries search a Spanish index.** A cross-lingual index cost 32 unreachable topics and a
gate that leaked 100% of out-of-corpus questions instead of 47%.

---

## Reproducing it

```bash
npm install
npm run evals:recall        # retrieval recall, offline
npm run alcance             # what share of the corpus is reachable, offline
npm run evals:compuerta     # gate decisions over 120 cases, offline
```

To ask a question interactively you need a provider key in `.env.local` (see `.env.example`):

```bash
npm run ask -- en "Why is the sky blue?"
```

The corpus pipeline (`pipeline/`) is Python and rebuilds every artifact from the two Project
Gutenberg source files, which are committed so that parsing is reproducible.

---

## Status

The evaluation phase is closed. The interface is not built yet — this repository is currently the
engine, its instruments, and the evidence.

## Sources and scope

Single source: Richter 1888, public domain. Where the notebooks are silent the system says so
rather than filling the gap; that silence is a feature and roughly a fifth of the evaluation set
exists to test it. Editorial commentary by Richter is separated from Leonardo's own words at parse
time and never attributed to him.
