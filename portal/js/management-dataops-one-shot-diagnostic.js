import { callApiAction, clearApiAuth, setHubSessionAuth } from "./api.js?v=idea-link-handoff-launch-20260712-6";
import { handleNovHubSessionAuthFailure } from "./nov-hub-session-candidate.js?v=20260712-1";
import {
  createManagementDataopsOneShotDiagnostic,
  createTrustedOneShotReviewControl,
  createTrustedResultCleanupControl
} from "./management-dataops-one-shot-core.js?v=20260713-2";

const BUILD_GATE = Object.freeze({
  enabled: false,
  id: "management-gate-c7-dataops-smoke",
  executionCountMax: 1,
  buildStamp: "management-gate-c7-4-source-review-20260713"
});

function inertHandle() {
  return Object.freeze({ installed: false, remove() {} });
}

export function installManagementDataopsOneShotDiagnostic({ isPinAuthenticated, getCurrentPinSession }) {
  if (BUILD_GATE.enabled !== true) return inertHandle();

  const output = document.createElement("output");
  output.id = "management-c7-dataops-one-shot-result";
  output.hidden = true;
  output.setAttribute("aria-hidden", "true");
  let cleanupControl = null;

  const diagnostic = createManagementDataopsOneShotDiagnostic({
    buildGate: BUILD_GATE,
    isPinAuthenticated,
    getCurrentPinSession,
    setHubSessionAuth,
    callApiAction,
    clearApiAuth,
    clearSessionOnAuthFailure: handleNovHubSessionAuthFailure,
    publishSanitizedResult(result) {
      output.textContent = JSON.stringify(result);
      cleanupControl?.remove();
      cleanupControl = createTrustedResultCleanupControl({
        documentRef: document,
        onTrustedCleanup() {
          output.textContent = "";
          output.remove();
          cleanupControl = null;
        }
      });
      document.body.append(cleanupControl);
    }
  });

  const control = createTrustedOneShotReviewControl({
    documentRef: document,
    onTrustedAttempt(event) {
      void diagnostic.handleTrustedClick(event);
    }
  });
  document.body.append(control, output);

  return Object.freeze({
    installed: true,
    remove() {
      control.remove();
      cleanupControl?.remove();
      output.textContent = "";
      output.remove();
      cleanupControl = null;
    }
  });
}

export const MANAGEMENT_C7_4_BUILD_GATE = BUILD_GATE;
