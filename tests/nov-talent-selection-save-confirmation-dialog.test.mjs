import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCandidateActivityConfirmationController } from "../portal/talent/candidate-activity-confirmation.mjs";

function element() {
  const listeners = new Map();
  return {
    open: false,
    hidden: false,
    disabled: false,
    textContent: "",
    focusCount: 0,
    attributes: {},
    addEventListener(type, listener) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    async dispatch(type, event = {}) {
      const results = [];
      for (const listener of listeners.get(type) || []) results.push(await listener(event));
      return results;
    },
    click() { return this.dispatch("click", { preventDefault() {} }); },
    showModal() { this.open = true; },
    close() { this.open = false; },
    focus() { this.focusCount += 1; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
  };
}

function fixture() {
  const ids = [
    "candidate-activity-confirm-dialog", "candidate-activity-confirm-cancel", "candidate-activity-confirm-execute",
    "candidate-activity-confirm-candidate", "candidate-activity-confirm-event", "candidate-activity-confirm-date",
    "candidate-activity-confirm-reason",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, element()]));
  return { elements, document: { getElementById(id) { return elements[id] || null; } } };
}

const details = {
  candidateName: "確認対象学生",
  eventLabel: "面接済み",
  date: "2026-03-23",
  reason: "確認済みの面接実績を正式履歴へ登録するため",
  command: { candidateId: "00000000-0000-4000-8000-000000000001", expectedCandidateVersion: 1, token: "never-render" },
};

test("custom activity confirmation opens, cancels, reopens and restores focus without a write", async () => {
  const view = fixture();
  const save = element();
  let confirms = 0;
  const controller = createCandidateActivityConfirmationController({
    documentObject: view.document,
    onConfirm: async () => { confirms += 1; return false; },
  });

  assert.equal(controller.open({ ...details, focusTarget: save }), true);
  assert.equal(view.elements["candidate-activity-confirm-dialog"].open, true);
  assert.equal(view.elements["candidate-activity-confirm-candidate"].textContent, details.candidateName);
  assert.equal(view.elements["candidate-activity-confirm-event"].textContent, details.eventLabel);
  assert.equal(view.elements["candidate-activity-confirm-date"].textContent, details.date);
  assert.equal(view.elements["candidate-activity-confirm-reason"].textContent, details.reason);
  assert.equal(save.disabled, true);
  assert.equal(view.elements["candidate-activity-confirm-execute"].focusCount, 1);
  assert.doesNotMatch(Object.values(view.elements).map((item) => item.textContent).join(" "), /00000000|never-render|Version|RPC|token/iu);

  await view.elements["candidate-activity-confirm-cancel"].click();
  assert.equal(view.elements["candidate-activity-confirm-dialog"].open, false);
  assert.equal(save.disabled, false);
  assert.equal(save.focusCount, 1);
  assert.equal(confirms, 0);

  assert.equal(controller.open({ ...details, focusTarget: save }), true);
  await Promise.all([
    view.elements["candidate-activity-confirm-execute"].click(),
    view.elements["candidate-activity-confirm-execute"].click(),
  ]);
  assert.equal(confirms, 1);
  assert.equal(save.disabled, false);
  assert.equal(save.focusCount, 2);
});

test("Escape cancel closes the custom dialog and unknown date stays visibly unknown", async () => {
  const view = fixture();
  const save = element();
  const controller = createCandidateActivityConfirmationController({ documentObject: view.document, onConfirm: async () => false });
  assert.equal(controller.open({ ...details, date: null, focusTarget: save }), true);
  let prevented = 0;
  await view.elements["candidate-activity-confirm-dialog"].dispatch("cancel", { preventDefault() { prevented += 1; } });
  assert.equal(prevented, 1);
  assert.equal(view.elements["candidate-activity-confirm-dialog"].open, false);
  assert.equal(view.elements["candidate-activity-confirm-date"].textContent, "未登録");
  assert.equal(save.focusCount, 1);
});

test("successful confirmation releases the origin control without reopening the dialog", async () => {
  const view = fixture();
  const save = element();
  const controller = createCandidateActivityConfirmationController({ documentObject: view.document, onConfirm: async () => true });
  assert.equal(controller.open({ ...details, focusTarget: save }), true);
  assert.equal(await controller.confirm(), true);
  assert.equal(view.elements["candidate-activity-confirm-dialog"].open, false);
  assert.equal(save.disabled, false);
  assert.equal(save.focusCount, 0);
});

test("selection save path uses the custom dialog and keeps the existing API contract", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../portal/talent/index.html", import.meta.url), "utf8"),
    readFile(new URL("../portal/talent/app.mjs", import.meta.url), "utf8"),
  ]);
  const selectionSave = app.match(/function saveCandidateActivity[\s\S]*?async function executeCandidateActivitySave/u)?.[0] || "";
  assert.match(html, /id="candidate-activity-confirm-dialog"/u);
  assert.match(html, /id="candidate-activity-confirm-candidate"/u);
  assert.match(html, /id="candidate-activity-confirm-event"/u);
  assert.match(html, /id="candidate-activity-confirm-date"/u);
  assert.match(html, /id="candidate-activity-confirm-reason"/u);
  assert.match(selectionSave, /activityConfirmationController\?\.open/u);
  assert.doesNotMatch(selectionSave, /globalObject\.confirm|window\.confirm/u);
  assert.match(selectionSave, /candidateName:\s*student\.displayName/u);
  assert.doesNotMatch(selectionSave, /candidateName:\s*student\.name/u);
  assert.match(selectionSave, /guardCandidateActivitySession\(documentObject\)/u);
  assert.match(app, /result\?\.category === "auth_required"[\s\S]*?HUB_SESSION_REAUTH_MESSAGE/u);
  assert.match(app, /getNovHubSessionStatus/u);
  assert.match(app, /mutateActivity\(command\)/u);
  assert.match(app, /candidate-activity-confirmation\.mjs\?v=20260810-session-expiry-ux-1/u);
});
