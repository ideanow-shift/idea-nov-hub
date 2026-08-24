(() => {
  const fragment = new URLSearchParams(location.hash.replace(/^#/u, ""));
  const challenge = String(fragment.get("enrollment") || "");
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
  Object.defineProperty(globalThis, "__NOV_HUB_STAGING_ENROLLMENT__", {
    configurable: true,
    value: /^[A-Za-z0-9_-]{43}$/u.test(challenge) ? challenge : "",
    writable: true
  });
})();
