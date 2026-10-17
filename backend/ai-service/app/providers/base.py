"""Provider abstraction for the AI service.

A provider turns structured inputs into structured outputs. The rule-based
provider is deterministic and requires no external credentials; an OpenAI
provider is selected automatically when OPENAI_API_KEY is present.
"""
from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    name: str = "base"

    @abstractmethod
    def analyze_cv(self, text: str, filename: str | None = None) -> dict[str, Any]:
        ...

    @abstractmethod
    def generate_cv(self, profile: dict[str, Any]) -> dict[str, Any]:
        ...

    @abstractmethod
    def tailor_cv(self, cv_text: str, job: dict[str, Any]) -> dict[str, Any]:
        ...

    @abstractmethod
    def translate_cv(self, document: dict[str, Any], source_locale: str, target_locale: str, context: dict[str, Any]) -> dict[str, Any]:
        ...

    @abstractmethod
    def analyze_job(self, job: dict[str, Any]) -> dict[str, Any]:
        ...

    @abstractmethod
    def match(self, candidate: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
        ...

    @abstractmethod
    def cover_letter(self, candidate: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
        ...

    @abstractmethod
    def interview(self, job: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
        ...
