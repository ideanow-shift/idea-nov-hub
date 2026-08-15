import { DBF_IMPORT_RUNTIME } from "./dbf-business-data-runtime.js";

const COMPANY_ID = "e4059116-bdb3-4e13-9763-bbc77bdfe062";
const MONTH = "2026-06";
const SEMANTICS = ["POSTABLE_DETAIL", "DERIVED_SUBTOTAL", "CONTROL_TOTAL", "DISPLAY_ONLY", "NEEDS_OWNER_REVIEW"];
const DECISIONS = ["APPROVE", "EDIT_AND_APPROVE", "EXCLUDE", "NEEDS_REVIEW"];
const CATEGORIES = {
  PL: ["revenue", "cost_of_sales", "gross_profit", "personnel_cost", "operating_expense", "operating_profit"],
  BS: ["current_asset", "noncurrent_asset", "current_liability", "noncurrent_liability", "equity"],
};

function el(doc, tag, className = "", text = "") {
  const value = doc.createElement(tag); value.className = className; if (text) value.textContent = text; return value;
}
function select(doc, values, current, blank = "選択してください") {
  const value = el(doc, "select", "dbf-account-review-input");
  value.append(new Option(blank, "")); values.forEach((item) => value.append(new Option(item, item)));
  value.value = current || ""; return value;
}
function metric(doc, label, value) { const card=el(doc,"article","dbf-account-review-metric"); card.append(el(doc,"span","",label),el(doc,"strong","",String(value))); return card; }

function reviewRow(doc, item, refresh) {
  const row=el(doc,"tr"); row.dataset.candidateId=item.candidateId;
  const td=(content) => { const cell=el(doc,"td"); typeof content === "string" ? cell.textContent=content : cell.append(content); row.append(cell); };
  td(item.sourceAccountName); td(item.candidateSourceCode);
  const code=el(doc,"input","dbf-account-review-input"); code.value=item.proposedCanonicalAccountCode||""; code.placeholder="Ownerが入力"; td(code);
  const name=el(doc,"input","dbf-account-review-input"); name.value=item.proposedCanonicalAccountName||item.sourceAccountName; td(name);
  const category=select(doc,CATEGORIES[item.statementType]||[],item.classification); td(category);
  const balance=select(doc,["debit","credit"],item.normalBalance); td(balance);
  const semantics=select(doc,SEMANTICS,item.rowSemantics); td(semantics);
  td(`${item.selectedCorporateRowCount} / ${item.futureStoreDetailRowCount}`);
  const decision=select(doc,DECISIONS,item.mappingStatus,"Owner decision"); td(decision);
  const save=el(doc,"button","business-data-action","保存"); save.type="button";
  save.addEventListener("click",async()=>{
    save.disabled=true;
    try {
      const sem=semantics.value||null;
      await DBF_IMPORT_RUNTIME.accountReviewDecide({
        candidateId:item.candidateId,requestId:crypto.randomUUID(),decision:decision.value,
        proposedAccountCode:code.value.trim()||null,proposedAccountName:name.value.trim()||null,
        accountCategory:category.value||null,normalBalance:balance.value||null,parentCandidateId:null,hierarchyLevel:0,
        rowSemantics:sem,isPostable:sem==="POSTABLE_DETAIL",isControlTotal:sem==="CONTROL_TOTAL",
      });
      await refresh();
    } catch (error) { save.textContent=`拒否: ${error.message}`; save.disabled=false; }
  }); td(save);
  return row;
}

export function createDbfAccountMappingReview(doc) {
  const panel=el(doc,"section","business-data-preview-panel dbf-account-review");
  panel.dataset.businessDataPanel="account-review"; panel.hidden=true;
  panel.append(el(doc,"h3","","Account Mapping Review"),el(doc,"p","","法人会計Actual 2026-06専用。店舗別P/Lは対象外で、Promotionは無効です。"));
  const summary=el(doc,"div","dbf-account-review-summary");
  const master=el(doc,"p","dbf-account-review-master","店舗マスタ: 法人6 / 総数22 / 有効21 / 無効1 / 営業店舗20（DIRECT 13・FC 7）/ HEAD_OFFICE 1（非店舗）");
  const status=el(doc,"p","business-data-runtime-status","読み込み中…");
  const filters=el(doc,"div","dbf-account-review-filters");
  const statement=select(doc,["ALL","PL","BS"],"ALL","");
  const state=select(doc,["ALL","UNREVIEWED","APPROVE","EDIT_AND_APPROVE","EXCLUDE","NEEDS_REVIEW"],"ALL","");
  filters.append(statement,state);
  const wrap=el(doc,"div","dbf-account-review-table-wrap");
  const table=el(doc,"table","dbf-account-review-table");
  table.innerHTML="<thead><tr><th>Source account</th><th>Candidate code</th><th>Proposed code</th><th>Proposed name</th><th>Classification</th><th>Normal balance</th><th>Row semantics</th><th>法人 / 将来店舗</th><th>Decision</th><th>保存</th></tr></thead>";
  const body=el(doc,"tbody"); table.append(body); wrap.append(table);
  const promotion=el(doc,"button","business-data-danger-action business-data-disabled-action","Promotion disabled（Owner Review 138/138完了後も別承認）"); promotion.disabled=true;
  let data=null;
  const render=()=>{
    if(!data)return; summary.replaceChildren(
      metric(doc,"候補",data.summary.candidates),metric(doc,"承認",data.summary.approved),metric(doc,"編集承認",data.summary.editAndApproved),
      metric(doc,"除外",data.summary.excluded),metric(doc,"Needs Review",data.summary.needsReview),metric(doc,"未確認",data.summary.unreviewed),
      metric(doc,"法人P/L",data.summary.corporatePlRows),metric(doc,"法人B/S",data.summary.corporateBsRows)
    );
    body.replaceChildren();
    data.items.filter((item)=>(statement.value==="ALL"||item.statementType===statement.value)&&(state.value==="ALL"||item.mappingStatus===state.value))
      .forEach((item)=>body.append(reviewRow(doc,item,load)));
    status.textContent=`${body.children.length}件表示 / Owner本人のDecisionのみ有効 / Audit append-only`;
  };
  const load=async()=>{ data=await DBF_IMPORT_RUNTIME.accountReviewList({companyId:COMPANY_ID,fiscalMonth:MONTH}); render(); };
  statement.addEventListener("change",render); state.addEventListener("change",render);
  panel.append(summary,master,filters,status,wrap,promotion);
  panel.loadAccountReview=load;
  return panel;
}
