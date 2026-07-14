import { callApiAction, clearApiAuth, setHubSessionAuth } from "./api.js?v=idea-link-handoff-launch-20260712-6";
import { handleNovHubSessionAuthFailure } from "./nov-hub-session-candidate.js?v=20260712-1";
import {
  createManagementDataopsOneShotDiagnostic,
  createTrustedOneShotReviewControl,
  createTrustedResultCleanupControl
} from "./management-dataops-one-shot-core.js?v=2574e489b55e09a2";

const BUILD_GATE = Object.freeze({
  enabled: true,
  id: "management-gate-c7-dataops-smoke",
  executionCountMax: 1,
  buildStamp: "management-gate-c7-5-execution-approved-20260713"
});

function inertHandle() {
  return Object.freeze({ installed: false, remove() {} });
}

export function installManagementDataopsOneShotDiagnostic({
  isPinAuthenticated,
  isAuthorizedForDiagnostic,
  getCurrentPinSession
}) {
  if (BUILD_GATE.enabled !== true
    || isPinAuthenticated?.() !== true
    || isAuthorizedForDiagnostic?.() !== true) return inertHandle();

  const portalScreen = document.getElementById("portal-screen");
  const welcome = portalScreen?.querySelector(".welcome");
  if (!portalScreen || !welcome) return inertHandle();

  const panel = document.createElement("section");
  panel.id = "management-c7-dataops-diagnostic-panel";
  panel.setAttribute("aria-labelledby", "management-c7-dataops-diagnostic-heading");
  Object.assign(panel.style, {
    display: "grid",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    margin: "16px 0",
    padding: "16px",
    border: "1px solid #c9d5e3",
    borderRadius: "8px",
    background: "#f7faff",
    color: "#13263a"
  });

  const heading = document.createElement("h2");
  heading.id = "management-c7-dataops-diagnostic-heading";
  heading.textContent = "経営管理データ診断";
  Object.assign(heading.style, {
    margin: "0",
    fontSize: "18px",
    lineHeight: "1.5"
  });

  const description = document.createElement("p");
  description.id = "management-c7-dataops-one-shot-description";
  description.textContent = "データ連携状態を安全に1回だけ確認します。";
  Object.assign(description.style, {
    margin: "0",
    color: "#526477",
    fontSize: "14px",
    lineHeight: "1.6"
  });

  const resultLabel = document.createElement("h3");
  resultLabel.id = "management-c7-dataops-result-label";
  resultLabel.textContent = "診断結果";
  resultLabel.hidden = true;
  Object.assign(resultLabel.style, {
    margin: "0",
    fontSize: "16px",
    lineHeight: "1.5"
  });

  const output = document.createElement("output");
  output.id = "management-c7-dataops-one-shot-result";
  output.hidden = true;
  output.setAttribute("aria-live", "polite");
  output.setAttribute("aria-atomic", "true");
  output.setAttribute("aria-labelledby", resultLabel.id);
  Object.assign(output.style, {
    display: "none",
    boxSizing: "border-box",
    width: "100%",
    padding: "12px",
    border: "1px solid #d8e0ea",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#17324d",
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: "12px",
    lineHeight: "1.6",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap"
  });
  let cleanupControl = null;
  let control = null;

  const diagnostic = createManagementDataopsOneShotDiagnostic({
    buildGate: BUILD_GATE,
    isPinAuthenticated,
    getCurrentPinSession,
    setHubSessionAuth,
    callApiAction,
    clearApiAuth,
    clearSessionOnAuthFailure: handleNovHubSessionAuthFailure,
    publishSanitizedResult(result) {
      control?.remove();
      description.hidden = true;
      resultLabel.hidden = false;
      output.hidden = false;
      output.style.display = "block";
      output.textContent = JSON.stringify(result);
      cleanupControl?.remove();
      cleanupControl = createTrustedResultCleanupControl({
        documentRef: document,
        onTrustedCleanup() {
          output.textContent = "";
          panel.remove();
          cleanupControl = null;
        }
      });
      panel.append(cleanupControl);
    }
  });

  control = createTrustedOneShotReviewControl({
    documentRef: document,
    onTrustedAttempt(event) {
      void diagnostic.handleTrustedClick(event);
    }
  });
  panel.append(heading, description, control, resultLabel, output);
  welcome.insertAdjacentElement("afterend", panel);

  return Object.freeze({
    installed: true,
    remove() {
      control.remove();
      cleanupControl?.remove();
      output.textContent = "";
      panel.remove();
      cleanupControl = null;
    }
  });
}

export const MANAGEMENT_C7_4_BUILD_GATE = BUILD_GATE;
