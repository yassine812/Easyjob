import os

from app.providers.base import AIProvider
from app.providers.rule_based import RuleBasedProvider

_active_provider: AIProvider | None = None


def get_provider() -> AIProvider:
    """Returns the configured provider.

    Selection order:
      1. AI_PROVIDER=rule_based  → deterministic provider (dev/tests)
      2. AI_PROVIDER=openai      → OpenAI-compatible provider
      3. OPENAI_API_KEY set      → OpenAI-compatible provider
      4. otherwise               → rule-based provider
    """
    global _active_provider
    if _active_provider is None:
        choice = os.getenv("AI_PROVIDER", "").lower()
        if choice == "rule_based":
            _active_provider = RuleBasedProvider()
        elif choice == "openai" or os.getenv("OPENAI_API_KEY"):
            from app.providers.openai import OpenAIProvider

            _active_provider = OpenAIProvider()
        else:
            _active_provider = RuleBasedProvider()
    return _active_provider
