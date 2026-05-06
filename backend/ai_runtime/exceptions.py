from __future__ import annotations


class ModelGatewayError(Exception):
    def __init__(self, message: str, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class PromptNotFoundError(Exception):
    pass


class StructuredOutputError(Exception):
    def __init__(self, schema_name: str, last_error: Exception) -> None:
        super().__init__(f"Structured output failed for schema '{schema_name}': {last_error}")
        self.schema_name = schema_name
        self.last_error = last_error


class DailyCostCapExceeded(Exception):
    def __init__(self, tenant_id: str, daily_spend: float, cap: float) -> None:
        super().__init__(
            f"Tenant {tenant_id} daily spend ${daily_spend:.4f} exceeds cap ${cap:.4f}"
        )
        self.tenant_id = tenant_id
        self.daily_spend = daily_spend
        self.cap = cap
