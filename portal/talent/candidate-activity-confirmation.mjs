function setText(documentObject, id, value) {
  const element = documentObject?.getElementById?.(id);
  if (element) element.textContent = String(value ?? "");
}

function setDisabled(element, disabled) {
  if (!element) return;
  element.disabled = disabled;
  element.setAttribute?.("aria-disabled", String(disabled));
}

export function createCandidateActivityConfirmationController({ documentObject, onConfirm } = {}) {
  const dialog = documentObject?.getElementById?.("candidate-activity-confirm-dialog");
  const cancelButton = documentObject?.getElementById?.("candidate-activity-confirm-cancel");
  const confirmButton = documentObject?.getElementById?.("candidate-activity-confirm-execute");
  if (!dialog || !cancelButton || !confirmButton || typeof onConfirm !== "function") return null;

  let pending = null;
  let returnFocus = null;
  let confirming = false;

  const restore = ({ focus = true } = {}) => {
    setDisabled(returnFocus, false);
    const focusTarget = returnFocus;
    if (focus && typeof documentObject?.defaultView?.setTimeout === "function") {
      documentObject.defaultView.setTimeout(() => focusTarget?.focus?.(), 0);
    }
    else if (focus) focusTarget?.focus?.();
    returnFocus = null;
  };

  const close = ({ restoreFocus = true } = {}) => {
    if (dialog.open) dialog.close?.();
    pending = null;
    confirming = false;
    setDisabled(cancelButton, false);
    setDisabled(confirmButton, false);
    restore({ focus: restoreFocus });
  };

  const cancel = () => {
    if (confirming) return false;
    close();
    return true;
  };

  const confirm = async () => {
    if (!pending || confirming) return false;
    confirming = true;
    setDisabled(cancelButton, true);
    setDisabled(confirmButton, true);
    const command = pending.command;
    if (dialog.open) dialog.close?.();
    let succeeded = false;
    try {
      succeeded = await onConfirm(command);
    } catch {
      succeeded = false;
    }
    pending = null;
    confirming = false;
    setDisabled(cancelButton, false);
    setDisabled(confirmButton, false);
    restore({ focus: !succeeded });
    return Boolean(succeeded);
  };

  const open = ({ candidateName, eventLabel, date, reason, command, focusTarget } = {}) => {
    if (pending || confirming || !candidateName || !eventLabel || !reason || !command) return false;
    pending = Object.freeze({ command });
    returnFocus = focusTarget || null;
    setDisabled(returnFocus, true);
    setText(documentObject, "candidate-activity-confirm-candidate", candidateName);
    setText(documentObject, "candidate-activity-confirm-event", eventLabel);
    setText(documentObject, "candidate-activity-confirm-date", date || "未登録");
    setText(documentObject, "candidate-activity-confirm-reason", reason);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.hidden = false;
    confirmButton.focus?.();
    return true;
  };

  cancelButton.addEventListener?.("click", cancel);
  confirmButton.addEventListener?.("click", confirm);
  dialog.addEventListener?.("cancel", (event) => {
    event.preventDefault?.();
    cancel();
  });

  return Object.freeze({ open, cancel, confirm, close, isOpen: () => Boolean(pending) });
}
