from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from ai_runtime.exceptions import PromptNotFoundError

_PROMPTS_ROOT = os.path.join(os.path.dirname(__file__), "..", "prompts")


def _resolve_version(agent_name: str, version: str) -> str:
    """Return the actual version string to load; resolves 'latest' to highest lex version."""
    if version != "latest":
        return version

    agent_dir = os.path.join(_PROMPTS_ROOT, agent_name)
    if not os.path.isdir(agent_dir):
        raise PromptNotFoundError(f"No prompt directory for agent '{agent_name}'")

    candidates = [
        f[:-3] for f in os.listdir(agent_dir) if f.endswith(".md")
    ]
    if not candidates:
        raise PromptNotFoundError(f"No prompt files found for agent '{agent_name}'")

    return sorted(candidates)[-1]


@lru_cache(maxsize=128)
def _load(cache_key: str) -> str:
    agent_name, version = cache_key.split(":", 1)
    path = os.path.join(_PROMPTS_ROOT, agent_name, f"{version}.md")
    if not os.path.isfile(path):
        raise PromptNotFoundError(f"Prompt file not found: {path}")
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def get_prompt(agent_name: str, version: str = "latest") -> str:
    resolved = _resolve_version(agent_name, version)
    return _load(f"{agent_name}:{resolved}")
