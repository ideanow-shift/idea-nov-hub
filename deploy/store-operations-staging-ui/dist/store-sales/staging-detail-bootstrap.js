const timer = window.setInterval(() => {
  const detailButton = [...document.querySelectorAll("button")]
    .find((button) => button.textContent.trim() === "店舗詳細を確認");
  if (!detailButton) return;
  window.clearInterval(timer);
  detailButton.click();
}, 50);

window.setTimeout(() => window.clearInterval(timer), 5_000);
