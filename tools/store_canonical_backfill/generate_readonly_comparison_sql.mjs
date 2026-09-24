import { readFileSync } from "node:fs";

import { buildHistoricalStoreActualPlan } from "./prepare_historical_store_actuals.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((value) => value.split("=", 2)));
if (!args["--csv"] || !args["--retail"] || !args["--metric"]) throw new Error("USAGE");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const plan = buildHistoricalStoreActualPlan(
  readFileSync(args["--csv"], "utf8"),
  JSON.parse(readFileSync(args["--retail"], "utf8")),
);
const rows = plan.candidates
  .filter(({ candidate }) => candidate.classification === "existing" && candidate.metric_code === args["--metric"])
  .map(({ candidate }) => `(${quote(candidate.fiscal_month)}::date,${quote(candidate.company_id)}::uuid,${quote(candidate.store_id)}::uuid,${quote(candidate.metric_code)},${quote(candidate.value)}::numeric,${quote(candidate.value_kind)})`);
if (!rows.length) throw new Error("METRIC_NOT_FOUND");
process.stdout.write(`with expected(fiscal_month,company_id,store_id,metric_code,source_value,value_kind) as (values
${rows.join(",\n")}
), compared as (
  select e.*,case e.value_kind when 'amount' then f.amount else f.quantity end as production_value
  from expected e left join public.dbf_store_monthly_metric_facts f
    on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id and f.store_id=e.store_id
   and f.metric_code=e.metric_code and f.is_active
)
select metric_code,count(*) as expected_rows,
  count(*) filter (where production_value is null) as missing,
  count(*) filter (where production_value is distinct from source_value) as exact_mismatch,
  max(abs(production_value-source_value)) as max_exact_delta
from compared group by metric_code;`);
