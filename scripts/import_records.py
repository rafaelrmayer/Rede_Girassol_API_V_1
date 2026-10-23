#!/usr/bin/env python3
"""Send a batch of already-normalized JSON records to the Rede Girassol API.

This script does not download or parse the raw CNES/ANS files. Inspect and map
official source fields before using it. The API endpoint currently records
import batches; entity-specific persistence is still a development task.
"""
import argparse
import json
import os
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="JSON file with a top-level list or {'records': [...]}")
    parser.add_argument("--source", required=True, choices=["cnes", "ans", "manual"])
    parser.add_argument("--api-url", default=os.environ.get("API_URL", "http://127.0.0.1:8787"))
    parser.add_argument("--token", default=os.environ.get("IMPORT_TOKEN"))
    args = parser.parse_args()

    if not args.token:
        parser.error("Provide --token or set IMPORT_TOKEN in the environment.")

    with open(args.file, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    records = payload if isinstance(payload, list) else payload.get("records", [])
    if not isinstance(records, list):
        parser.error("JSON must be a list or contain a 'records' list.")
    if len(records) > 100:
        parser.error("Maximum 100 records per request.")

    body = json.dumps({"source": args.source, "records": records}).encode("utf-8")
    request = urllib.request.Request(
        args.api_url.rstrip("/") + "/admin/import",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {args.token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        print(f"HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
