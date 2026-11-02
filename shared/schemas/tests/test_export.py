from pathlib import Path

from shared_schemas.export import main as export_main

REPO_ROOT = Path(__file__).resolve().parents[3]


def test_contract_files_are_up_to_date() -> None:
    out = REPO_ROOT / "docs" / "contracts"
    assert export_main(["--check", "--out", str(out)]) == 0, (
        "Contract files are stale: run `uv run python -m shared_schemas.export`"
    )
