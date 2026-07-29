from __future__ import annotations

from datetime import date

from .calculator import KpiCalculator
from .core_adapter import CoreProjectionError, PublishedCoreProjection
from .domain import DataState, KpiResult
from .repository import KpiRepository


class KpiWorkflow:
    def __init__(self, repository: KpiRepository, projection: PublishedCoreProjection):
        self.repository = repository
        self.projection = projection
        self.calculator = KpiCalculator()

    def run(
        self,
        accounting_version_id: str,
        entity_id: str,
        scope_type: str,
        period: date,
        triggered_by: str,
        definition_codes: tuple[str, ...],
        preview: bool = False,
    ) -> tuple[str, list[KpiResult]]:
        run_id = self.repository.create_run(
            accounting_version_id, entity_id, scope_type, period.isoformat(), triggered_by
        )
        try:
            facts = self.projection.facts_for(accounting_version_id, entity_id, scope_type, period)
        except CoreProjectionError as error:
            self.repository.db.execute(
                "UPDATE accounting_kpi_calculation_runs SET status='failed',failure_reason=? WHERE id=?",
                (str(error), run_id),
            )
            raise
        results = [
            self.calculator.calculate(
                self.repository.definitions[code],
                self.repository.groups,
                facts,
                run_id,
                preview=preview,
            )
            for code in definition_codes
        ]
        for result in results:
            self.repository.save_result(result)
        self.repository.complete_run(run_id)
        return run_id, results
