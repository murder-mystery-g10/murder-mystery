# Interrogation model choice

## Decision

Use **`gpt-5-mini` with `AI_REASONING_EFFORT=minimal`** for the MVP interrogation
flow.

It was slightly slower than `gpt-4.1-mini`, but it followed the break-state and
evidence rules much more reliably. Those rules protect the mystery and are more
important than the roughly 0.23 s median-latency difference.

## Latest run: reworked case (2026-11-08)

Only `gpt-5-mini` was re-run, on the reworked Vornicu case (#47), after two prompt
fixes found by this run:

- Revealed testimony IDs: only IDs whose fact the answer states, never clue IDs,
  times or other values. Before the fix, Ana reported a testimony she had not told,
  and the doctor returned the clue ID `B1`.
- Before breaking, a suspect keeps every lie from the sheet. Before the fix, the
  doctor admitted the library visit when asked directly, without any evidence.

| Model | Passed | Pass rate | Mean | Median | p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `gpt-5-mini` | 32/36 | 88.9% | 1.713 s | 1.664 s | 2.457 s | 3.138 s |

The four remaining failures do not affect the game:

- Two prompt-injection scenarios (Ana, Victor) hit the Azure content filter. The
  service turns that into HTTP 503, as on 2026-11-04.
- Elena denied the affair but used the word "lovers" in the denial, which the
  scenario counts as forbidden.
- At his first break, the doctor admitted the right facts but returned the junk
  value `testimonies` as a testimony ID; the server-side filter removed it.

All 34 completed answers behaved correctly in the game's terms (the right
admissions, no leaked secrets, no wrong testimonies after filtering). The model
still occasionally returns invalid IDs, so the server-side filter in
`run_interrogation` stays necessary.

## Model comparison (2026-11-04)

The comparison below was run on the first version of the case, before the
rework.

### Method

Benchmark date: **2026-11-04**. Provider: Azure OpenAI v1 API. Case:
`vornicu_1926`.

The reproducible benchmark is
`ai-service/benchmarks/interrogate_models.py`. It ran 36 fixed scenarios once per
model (72 calls total):

- 8 ordinary or secret-keeping questions;
- 8 testimony-trigger questions;
- 6 break-stage scenarios;
- 2 evidence-without-break scenarios;
- 2 locked-testimony scenarios;
- 4 anti-spoiler questions;
- 4 prompt-injection attempts;
- 2 ordinary whereabouts questions.

Each response was checked for strict-schema success, testimony IDs before and
after server-side filtering, required or forbidden facts, English output, and
the 1–4 sentence limit. Latency is wall-clock time around the production
`run_interrogation` flow. This is a small deterministic regression set, not a
statistically significant load test.

Run it from the repository root:

```bash
uv run --package ai-service python ai-service/benchmarks/interrogate_models.py \
  --output /tmp/interrogate-benchmark.json
```

`gpt-4.1-mini` is called without `reasoning_effort`; `gpt-5-mini` uses
`minimal`.

### Results

| Model | Passed | Pass rate | Mean | Median | p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `gpt-5-mini` | 35/36 | 97.2% | 1.563 s | 1.487 s | 2.195 s | 2.564 s |
| `gpt-4.1-mini` | 29/36 | 80.6% | 1.331 s | 1.272 s | 1.708 s | 2.120 s |

Both models hit the Azure content filter on the same explicit prompt-injection
scenario. The service correctly turns that provider error into HTTP 503. If that
shared infrastructure error is excluded, the rates are 35/35 (100%) for
`gpt-5-mini` and 29/35 (82.9%) for `gpt-4.1-mini`.

#### Behavior by category

| Category | Scenarios | `gpt-5-mini` | `gpt-4.1-mini` |
| --- | ---: | ---: | ---: |
| Anti-spoiler | 4 | 4 | 4 |
| Break stages | 6 | 6 | 2 |
| Evidence without a break | 2 | 2 | 0 |
| Prompt injection | 4 | 3 | 3 |
| Locked testimony | 2 | 2 | 2 |
| Ordinary | 2 | 2 | 2 |
| Secret keeping | 8 | 8 | 8 |
| Testimony triggers | 8 | 8 | 8 |

The post-response filter removed unavailable or invalid testimony IDs correctly
in every completed call for both models. This confirms that deterministic
server-side filtering is still necessary even with structured output.

### Notable failures

`gpt-4.1-mini` failed the behavior most important to the game:

- Elena continued denying the greenhouse visit even when `just_broke` required
  her to admit the affair.
- Strat rationalized the digitoxin purchase instead of confessing at the final
  break stage.
- With evidence shown but no break, Strat implicitly admitted visiting the
  library and returned the physical clue ID `B1` as though it were a testimony.
- On a correct first-stage admission, it again returned `B1`; production code
  filtered the invalid ID, but the raw structured response was wrong.
- Victor omitted the 20,000 lei amount from the required break-stage admission.
- One evidence response exceeded the 1–4 sentence limit.

`gpt-5-mini` passed every completed behavioral scenario. Its only failure was
the shared Azure content-filter response described above.

### Lifecycle note

Both Azure deployments were available during this benchmark. The current public
OpenAI model catalog marks
[`gpt-4.1-mini` as deprecated](https://developers.openai.com/api/docs/models/gpt-4.1-mini),
and the public
[deprecation schedule](https://developers.openai.com/api/docs/deprecations)
lists the older `gpt-5-mini` generation for removal on 2026-12-11. Azure model
lifecycle dates can differ, so confirm the Azure deployment timeline before the
MVP goes to production and rerun this benchmark when changing deployments.

## Conclusion

Keep the current configuration:

```dotenv
AI_MODEL=gpt-5-mini
AI_REASONING_EFFORT=minimal
```

The latency tradeoff is small, while the improvement in break-stage compliance
is substantial. Do not switch the MVP to `gpt-4.1-mini`.
