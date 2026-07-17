const summaries = Object.freeze({
  staff: { pending: 0, completed: 0, review: 0 },
  store: { pending: 0, completed: 0, review: 0 },
  admin: { pending: 0, completed: 0, review: 0 }
});

function setView(view) {
  if (!Object.hasOwn(summaries, view)) return;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== view;
  });
  Object.entries(summaries[view]).forEach(([key, value]) => {
    const target = document.querySelector(`[data-summary="${key}"]`);
    if (target) target.textContent = String(value);
  });
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
setView("staff");
