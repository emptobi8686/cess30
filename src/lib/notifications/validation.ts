const SAFE_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];

export function isSafePushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const hostAllowed =
      SAFE_PUSH_HOSTS.includes(url.hostname) ||
      url.hostname.endsWith(".push.services.mozilla.com") ||
      url.hostname.endsWith(".notify.windows.com");

    return (
      url.protocol === "https:" &&
      url.port === "" &&
      !url.username &&
      !url.password &&
      hostAllowed
    );
  } catch {
    return false;
  }
}

export function getSafeActionUrl(actionUrl: string | null) {
  if (
    !actionUrl ||
    !actionUrl.startsWith("/") ||
    actionUrl.startsWith("//") ||
    actionUrl.startsWith("/\\") ||
    /[\u0000-\u001f]/.test(actionUrl)
  ) {
    return "/notifications";
  }

  try {
    const parsed = new URL(actionUrl, "https://blueprint.invalid");
    if (parsed.origin !== "https://blueprint.invalid") return "/notifications";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/notifications";
  }
}
