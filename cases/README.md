# Cases

The library of ready-to-play cases, one JSON file per case. Every file follows the case schema
(`shared_schemas.case.Case`, exported to [docs/contracts/case.schema.json](../docs/contracts/case.schema.json))
and passes the checklist in [docs/case-design.md](../docs/case-design.md).

The backend loads these cases, and the host picks one in the lobby.

**Status:** one case, [vornicu_1926.json](vornicu_1926.json) ("Moarte la Conacul Vornicu"). `ai-service/tests/test_cases.py` checks that every file here matches the schema. **Owner:** the AI team, which generates and validates the cases.
