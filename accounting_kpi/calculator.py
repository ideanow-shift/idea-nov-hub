from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from .domain import AccountGroup, ApprovalStatus, CoreFact, DataState, KpiDefinition, KpiResult

ALLOWED_OPERATORS = {"account_group", "add", "subtract", "divide", "absolute", "average", "sum"}


class ExpressionError(ValueError):
    pass


def validate_expression(expression: object) -> None:
    if not isinstance(expression, dict) or expression.get("op") not in ALLOWED_OPERATORS:
        raise ExpressionError("expression operator is not allowed")
    op = expression["op"]
    if op == "account_group":
        if set(expression) != {"op", "code"} or not isinstance(expression["code"], str):
            raise ExpressionError("invalid account_group expression")
        return
    arguments = expression.get("args")
    if not isinstance(arguments, list) or not arguments:
        raise ExpressionError("operator requires args")
    if op in {"subtract", "divide"} and len(arguments) != 2:
        raise ExpressionError("binary operator requires two args")
    if op == "absolute" and len(arguments) != 1:
        raise ExpressionError("absolute requires one arg")
    for argument in arguments:
        validate_expression(argument)


class KpiCalculator:
    def calculate(
        self,
        definition: KpiDefinition,
        groups: dict[str, AccountGroup],
        facts: list[CoreFact],
        calculation_run_id: str,
        preview: bool = False,
    ) -> KpiResult:
        validate_expression(definition.numerator_expression)
        validate_expression(definition.denominator_expression)
        now = datetime.now(timezone.utc)
        base = dict(
            id=str(uuid.uuid4()),
            calculation_run_id=calculation_run_id,
            definition_id=definition.id,
            definition_version=definition.definition_version,
            accounting_version_id=facts[0].accounting_version_id if facts else "",
            entity_id=facts[0].entity_id if facts else "",
            scope_type=facts[0].scope_type if facts else "",
            period=facts[0].period if facts else definition.valid_from,
            unit=definition.unit,
            calculated_at=now,
        )
        if definition.approval_status is not ApprovalStatus.APPROVED and not preview:
            return KpiResult(**base, value=None, data_state=DataState.PREPARING,
                             reason_code="DEFINITION_NOT_APPROVED", missing_components=(),
                             numerator_value=None, denominator_value=None,
                             numerator_fact_ids=(), denominator_fact_ids=())
        missing_groups = tuple(
            code for code in definition.required_account_groups
            if code not in groups or groups[code].approval_status is not ApprovalStatus.APPROVED
        )
        if missing_groups:
            return KpiResult(**base, value=None, data_state=DataState.PREPARING,
                             reason_code="ACCOUNT_GROUP_NOT_APPROVED",
                             missing_components=missing_groups, numerator_value=None,
                             denominator_value=None, numerator_fact_ids=(), denominator_fact_ids=())
        if facts and facts[0].scope_type not in definition.applicable_scopes:
            return KpiResult(**base, value=None, data_state=DataState.UNAVAILABLE,
                             reason_code="SCOPE_NOT_APPLICABLE", missing_components=(),
                             numerator_value=None, denominator_value=None,
                             numerator_fact_ids=(), denominator_fact_ids=())
        try:
            numerator, numerator_ids, numerator_missing = self._evaluate(
                definition.numerator_expression, groups, facts, definition.amount_basis
            )
            denominator, denominator_ids, denominator_missing = self._evaluate(
                definition.denominator_expression, groups, facts, definition.amount_basis
            )
        except ValueError as error:
            return KpiResult(**base, value=None, data_state=DataState.VALIDATION_ERROR,
                             reason_code=str(error), missing_components=(),
                             numerator_value=None, denominator_value=None,
                             numerator_fact_ids=(), denominator_fact_ids=())
        missing = tuple(sorted(set(numerator_missing + denominator_missing)))
        if missing:
            return KpiResult(**base, value=None, data_state=DataState.PREPARING,
                             reason_code="MISSING_COMPONENT", missing_components=missing,
                             numerator_value=numerator, denominator_value=denominator,
                             numerator_fact_ids=numerator_ids, denominator_fact_ids=denominator_ids)
        if denominator == 0:
            return KpiResult(**base, value=None, data_state=DataState.UNAVAILABLE,
                             reason_code="ZERO_DENOMINATOR", missing_components=(),
                             numerator_value=numerator, denominator_value=denominator,
                             numerator_fact_ids=numerator_ids, denominator_fact_ids=denominator_ids)
        if denominator < 0:
            return KpiResult(**base, value=None, data_state=DataState.VALIDATION_ERROR,
                             reason_code="NEGATIVE_DENOMINATOR", missing_components=(),
                             numerator_value=numerator, denominator_value=denominator,
                             numerator_fact_ids=numerator_ids, denominator_fact_ids=denominator_ids)
        try:
            value = numerator / denominator
        except (InvalidOperation, ZeroDivisionError):
            raise ValueError("INVALID_DECIMAL_RESULT")
        if not value.is_finite():
            raise ValueError("INVALID_DECIMAL_RESULT")
        return KpiResult(**base, value=value, data_state=DataState.AVAILABLE,
                         reason_code=None, missing_components=(),
                         numerator_value=numerator, denominator_value=denominator,
                         numerator_fact_ids=numerator_ids, denominator_fact_ids=denominator_ids)

    def _evaluate(
        self,
        expression: dict,
        groups: dict[str, AccountGroup],
        facts: list[CoreFact],
        amount_basis: str,
    ) -> tuple[Decimal, tuple[str, ...], list[str]]:
        op = expression["op"]
        if op == "account_group":
            code = expression["code"]
            group = groups[code]
            members = set(group.canonical_account_members)
            selected = [
                fact for fact in facts
                if fact.canonical_account in members
                and group.member_effective_from <= fact.period
                and (group.member_effective_to is None or fact.period <= group.member_effective_to)
            ]
            if not selected:
                return Decimal(0), (), [code]
            if any(fact.amount_basis != amount_basis for fact in selected):
                raise ValueError("AMOUNT_BASIS_MISMATCH")
            return sum((fact.amount for fact in selected), Decimal(0)), tuple(fact.id for fact in selected), []
        evaluated = [self._evaluate(arg, groups, facts, amount_basis) for arg in expression["args"]]
        values = [item[0] for item in evaluated]
        ids = tuple(identifier for item in evaluated for identifier in item[1])
        missing = [code for item in evaluated for code in item[2]]
        if op in {"sum", "add"}:
            return sum(values, Decimal(0)), ids, missing
        if op == "subtract":
            return values[0] - values[1], ids, missing
        if op == "divide":
            if values[1] == 0:
                raise ValueError("ZERO_DENOMINATOR")
            return values[0] / values[1], ids, missing
        if op == "absolute":
            return abs(values[0]), ids, missing
        if op == "average":
            return sum(values, Decimal(0)) / Decimal(len(values)), ids, missing
        raise ExpressionError("unsupported expression")
