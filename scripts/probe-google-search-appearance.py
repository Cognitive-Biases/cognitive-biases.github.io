#!/usr/bin/env python3
"""Read-only Search Console probe for Search Analytics appearance values.

The probe intentionally does not claim that any appearance value is the dedicated
Generative AI performance report. It records the values that the public Search
Analytics API actually exposes for this property so downstream automation can be
evidence-led rather than based on guessed enum names.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
API_ROOT = "https://www.googleapis.com/webmasters/v3"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def create_session(credentials_file: str):
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account

    credentials = service_account.Credentials.from_service_account_file(
        credentials_file,
        scopes=[WEBMASTERS_SCOPE],
    )
    return AuthorizedSession(credentials)


def query_appearances(session, site_url: str, search_type: str, days: int) -> dict[str, Any]:
    end = datetime.now(timezone.utc).date() - timedelta(days=2)
    start = end - timedelta(days=days - 1)
    endpoint = f"{API_ROOT}/sites/{quote(site_url, safe='')}/searchAnalytics/query"
    payload = {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "type": search_type,
        "dataState": "final",
        "dimensions": ["searchAppearance"],
        "rowLimit": 250,
    }
    response = session.post(endpoint, json=payload, timeout=30)
    if response.status_code != 200:
        raise RuntimeError(
            f"Search Analytics appearance probe failed for {search_type} "
            f"({response.status_code}): {response.text[:500]}"
        )
    body = response.json()
    values = []
    for row in body.get("rows") or []:
        keys = row.get("keys") or []
        if not keys:
            continue
        values.append(
            {
                "value": str(keys[0]),
                "clicks": float(row.get("clicks") or 0.0),
                "impressions": float(row.get("impressions") or 0.0),
                "ctr": float(row.get("ctr") or 0.0),
                "position": float(row.get("position") or 0.0),
            }
        )
    values.sort(key=lambda item: (-item["impressions"], item["value"]))
    return {
        "search_type": search_type,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "values": values,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-url", required=True)
    parser.add_argument("--credentials", required=True)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--output", default="reports/seo/google-search/search-appearance-probe.json")
    args = parser.parse_args()
    if args.days < 1 or args.days > 365:
        raise SystemExit("--days must be between 1 and 365")
    if not args.site_url.startswith("https://"):
        raise SystemExit("--site-url must be HTTPS")

    session = create_session(args.credentials)
    reports = []
    for search_type in ("web", "discover"):
        try:
            reports.append(query_appearances(session, args.site_url, search_type, args.days))
        except RuntimeError as exc:
            reports.append({"search_type": search_type, "status": "unavailable", "error": str(exc)})

    output = {
        "version": "0.1",
        "generated_at": utc_now(),
        "site_url": args.site_url,
        "purpose": "Enumerate Search Analytics API searchAppearance values exposed for the authenticated property.",
        "guardrails": {
            "read_only": True,
            "no_generative_ai_inference_from_absence": True,
            "no_ranking_claim": True,
            "dedicated_generative_ai_report_not_assumed": True,
        },
        "reports": reports,
    }
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    for report in reports:
        values = report.get("values") or []
        names = ", ".join(item["value"] for item in values) if values else "(none)"
        print(f"{report['search_type']}: {names}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
