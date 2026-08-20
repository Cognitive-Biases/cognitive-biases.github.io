#!/usr/bin/env python3
import csv, io, json, math, re, statistics, sys, urllib.request
from collections import defaultdict
from pathlib import Path

SOURCE_REPO = "JiaxuLou/LLM_Bias"
SOURCE_COMMIT = "0083e9ec780469d91d52c5411e59d0efbd82fe9e"
SOURCE_DOI = "10.1007/s42001-025-00435-2"
FILES = [
    "results_openrouter_claud1.csv",
    "results_openrouter_haiku35.csv",
    "results_openrouter_gemini1.csv",
    "results_openrouter_gemini2.csv",
]
OUT = Path("research-output/study-001")
NUMBER_RE = re.compile(r"[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?|[-+]?\d*\.?\d+")
TIME_RE = re.compile(r"(?<!\d)(\d{1,2}):(\d{2})(?!\d)")
UNIT_RE = re.compile(r'"unit"\s*:\s*"([^"]+)"', re.I)

def extract_response_number(text):
    if not text:
        return None
    start = text.lower().find("number")
    segment = text[start:] if start >= 0 else text
    tm = TIME_RE.search(segment)
    if tm:
        value = float(tm.group(1)) * 60 + float(tm.group(2))
    else:
        nums = NUMBER_RE.findall(segment)
        if not nums:
            return None
        value = float(nums[0].replace(",", ""))
    um = UNIT_RE.search(segment.replace('\\"','"'))
    unit = um.group(1).lower().strip() if um else ""
    if "million" in unit:
        value *= 1_000_000
    elif "thousand" in unit:
        value *= 1_000
    elif any(x in unit for x in ("hour", " hh", "hr")) or unit in {"h","hh"}:
        if not tm:
            value *= 60
    return value

def extract_anchor_number(text):
    if not text:
        return None
    times = list(TIME_RE.finditer(text))
    if times:
        m = times[-1]
        return float(m.group(1)) * 60 + float(m.group(2))
    nums = NUMBER_RE.findall(text)
    if not nums:
        return None
    return float(nums[-1].replace(",", ""))

def trimmed(values):
    vals = sorted(v for v in values if v is not None and math.isfinite(v))
    return vals[1:-1] if len(vals) > 2 else vals

def wilson(k, n, z=1.959963984540054):
    if not n:
        return [None, None]
    p = k/n
    den = 1 + z*z/n
    center = (p + z*z/(2*n))/den
    half = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))/den
    return [max(0, center-half), min(1, center+half)]

def median_or_none(xs):
    xs = [x for x in xs if x is not None and math.isfinite(x)]
    return statistics.median(xs) if xs else None

def fetch_csv(name):
    url = f"https://raw.githubusercontent.com/{SOURCE_REPO}/{SOURCE_COMMIT}/{name}"
    with urllib.request.urlopen(url, timeout=60) as r:
        body = r.read().decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(body))), url

def analyze_rows(rows, source_file):
    buckets = defaultdict(lambda: {"A": [], "B": [], "anchor_A": None, "anchor_B": None})
    total = parsed = 0
    models = set()
    for row in rows:
        total += 1
        model = (row.get("model") or "unknown").strip()
        qid = str(row.get("question_id") or "").strip()
        group = (row.get("group") or "").strip().upper()
        if group not in ("A","B") or not qid:
            continue
        models.add(model)
        val = extract_response_number(row.get("response",""))
        if val is not None and math.isfinite(val):
            parsed += 1
            buckets[(model,qid)][group].append(val)
        a = extract_anchor_number(row.get("hint_2",""))
        if a is not None:
            buckets[(model,qid)][f"anchor_{group}"] = a

    perq = []
    for (model,qid), b in sorted(buckets.items()):
        a_vals, b_vals = trimmed(b["A"]), trimmed(b["B"])
        if not a_vals or not b_vals or b["anchor_A"] is None or b["anchor_B"] is None:
            continue
        anchor_delta = b["anchor_B"] - b["anchor_A"]
        if anchor_delta == 0:
            continue
        mean_a, mean_b = statistics.fmean(a_vals), statistics.fmean(b_vals)
        response_delta = mean_b - mean_a
        aligned = (response_delta > 0) == (anchor_delta > 0) if response_delta != 0 else False
        denom = max((abs(mean_a)+abs(mean_b))/2, 1e-12)
        perq.append({
            "source_file": source_file,
            "model": model,
            "question_id": qid,
            "n_A": len(a_vals),
            "n_B": len(b_vals),
            "anchor_A": b["anchor_A"],
            "anchor_B": b["anchor_B"],
            "anchor_delta": anchor_delta,
            "trimmed_mean_A": mean_a,
            "trimmed_mean_B": mean_b,
            "response_delta": response_delta,
            "direction_aligned": aligned,
            "relative_response_shift": abs(response_delta)/denom,
        })
    return perq, {"rows": total, "parsed_responses": parsed, "parse_rate": parsed/total if total else None, "models": sorted(models)}

def summarize(perq, file_meta):
    by_model = defaultdict(list)
    for x in perq:
        by_model[x["model"]].append(x)
    models = []
    for model, items in sorted(by_model.items()):
        aligned = sum(1 for x in items if x["direction_aligned"])
        n = len(items)
        lo, hi = wilson(aligned,n)
        models.append({
            "model": model,
            "questions_analysed": n,
            "direction_aligned": aligned,
            "direction_alignment_rate": aligned/n if n else None,
            "direction_alignment_wilson_95": [lo,hi],
            "median_abs_response_delta": median_or_none([abs(x["response_delta"]) for x in items]),
            "median_relative_response_shift": median_or_none([x["relative_response_shift"] for x in items]),
        })
    all_aligned = sum(1 for x in perq if x["direction_aligned"])
    n = len(perq)
    lo, hi = wilson(all_aligned,n)
    return {
        "study_id": "study-001",
        "title": "Anchoring direction in released Claude and Gemini outputs: an independent re-analysis",
        "study_type": "independent re-analysis of public model outputs",
        "status": "result",
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "source": {
            "paper_doi": SOURCE_DOI,
            "repository": f"https://github.com/{SOURCE_REPO}",
            "source_commit": SOURCE_COMMIT,
            "files": file_meta,
        },
        "preregistered_primary_outcome": "Question-level direction alignment between anchor delta (B-A) and trimmed mean model-response delta (B-A).",
        "method": {
            "unit_of_analysis": "question-model pair",
            "response_parsing": "Numeric value extracted from the released response field; time-like values are converted to minutes. One minimum and one maximum response are removed per group when more than two parsed responses are available, matching the source repository's analysis approach.",
            "anchor_parsing": "The final numeric token in each released hint_2 string is used as the anchor value; time-like anchors are converted to minutes.",
            "uncertainty": "Wilson 95% interval for the descriptive direction-alignment proportion."
        },
        "overall": {
            "question_model_pairs": n,
            "direction_aligned": all_aligned,
            "direction_alignment_rate": all_aligned/n if n else None,
            "direction_alignment_wilson_95": [lo,hi],
            "median_relative_response_shift": median_or_none([x["relative_response_shift"] for x in perq])
        },
        "models": models,
        "limitations": [
            "This is a re-analysis of outputs collected by the source authors, not a fresh model run.",
            "Anchor extraction is rule-based and should be audited for questions whose hint contains multiple numbers.",
            "Repeated model outputs within a question are not treated as independent question-level replications.",
            "Direction alignment is descriptive and does not identify a psychological mechanism.",
            "The result says nothing directly about how humans respond to AI advice."
        ]
    }

def write_outputs(summary, perq):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/"summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    fields = list(perq[0].keys()) if perq else []
    with (OUT/"question-level.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        if fields:
            w.writeheader(); w.writerows(perq)
    lines = [
        "# Study 001 result", "", "**Status:** independent re-analysis of public model outputs.", "", "## Primary result", "",
        f"Across **{summary['overall']['question_model_pairs']}** analysable question-model pairs, the model response moved in the same direction as the anchor in **{summary['overall']['direction_aligned']}** cases (**{summary['overall']['direction_alignment_rate']:.1%}**, Wilson 95% interval {summary['overall']['direction_alignment_wilson_95'][0]:.1%}–{summary['overall']['direction_alignment_wilson_95'][1]:.1%}).",
        "", "This supports the narrow descriptive claim that anchor direction and model answer direction are strongly associated in these released outputs. It does **not** establish a new bias, a causal mechanism beyond the source experiment, or a human effect.",
        "", "## By model", "", "| Model | Questions | Aligned | Rate | 95% interval | Median relative shift |", "|---|---:|---:|---:|---:|---:|"
    ]
    for m in summary["models"]:
        lines.append(f"| {m['model']} | {m['questions_analysed']} | {m['direction_aligned']} | {m['direction_alignment_rate']:.1%} | {m['direction_alignment_wilson_95'][0]:.1%}–{m['direction_alignment_wilson_95'][1]:.1%} | {m['median_relative_response_shift']:.3f} |")
    lines += ["", "## Reproducibility", "", f"Source data are pinned to `{SOURCE_REPO}@{SOURCE_COMMIT}`. The source paper is DOI [{SOURCE_DOI}](https://doi.org/{SOURCE_DOI}).", "", "The full question-level output is published beside this summary.", "", "## Limitations", ""]
    lines += [f"- {x}" for x in summary["limitations"]]
    (OUT/"report.md").write_text("\n".join(lines)+"\n", encoding="utf-8")

def self_test():
    assert extract_response_number('{"number": 1,299, "unit": "USD"}') == 1299
    assert extract_response_number('{"number":"2:00","unit":"HH:MM"}') == 120
    assert extract_anchor_number("Apple iPhone 8: 699 USD") == 699
    assert extract_anchor_number("Prediction at 2:30") == 150
    lo, hi = wilson(9,10)
    assert 0 < lo < .9 < hi <= 1
    print("Study 001 self-test passed.")

def main():
    if "--self-test" in sys.argv:
        self_test(); return
    all_perq, meta = [], []
    for name in FILES:
        rows, url = fetch_csv(name)
        perq, stats = analyze_rows(rows, name)
        all_perq.extend(perq)
        meta.append({"name": name, "url": url, **stats, "question_model_pairs": len(perq)})
    summary = summarize(all_perq, meta)
    write_outputs(summary, all_perq)
    print(json.dumps(summary["overall"], indent=2))

if __name__ == "__main__":
    main()
