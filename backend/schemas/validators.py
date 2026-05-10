import json
import os
from typing import Any

_SCHEMA_DIR = os.path.dirname(__file__)


def _load_schema(filename: str) -> dict:
    with open(os.path.join(_SCHEMA_DIR, filename)) as f:
        return json.load(f)


def validate_form_schema(data: Any) -> None:
    """Raise jsonschema.ValidationError if data is not a valid form schema."""
    import jsonschema
    schema = _load_schema("form_schema_v1.json")
    jsonschema.validate(data, schema)


def validate_audience_spec(data: Any) -> None:
    """Raise jsonschema.ValidationError if data is not a valid audience spec."""
    import jsonschema
    schema = _load_schema("audience_spec_v1.json")
    jsonschema.validate(data, schema)
