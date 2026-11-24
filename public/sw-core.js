/* BLUEPRINT service worker core. Pure helpers shared by sw.js (via importScripts)
 * and Node unit tests (via require). No DOM or worker APIs here. */
(function (root) {
  "use strict";

  var CACHE_VERSION = "blueprint-static-v2";
  var DEFAULT_TARGET = "/notifications";

  /** In-app paths only: rejects absolute, protocol-relative, backslash and control-character URLs. */
  function getSafeTarget(value) {
    if (
      typeof value !== "string" ||
      value.charAt(0) !== "/" ||
      value.slice(0, 2) === "//" ||
      value.indexOf("\\") !== -1 ||
      /[\u0000-\u001f]/.test(value)
    ) {
      return DEFAULT_TARGET;
    }
    return value;
  }

  /** Accepts a PushMessageData-like object ({ json() }) or null. */
  function parsePushPayload(data) {
    var payload = {};
    try {
      var parsed = data && typeof data.json === "function" ? data.json() : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
    } catch {
      payload = {};
    }
    var result = {
      title: typeof payload.title === "string" && payload.title ? payload.title : "BLUEPRINT",
      body: typeof payload.body === "string" && payload.body ? payload.body : "You have a new update.",
      target: getSafeTarget(payload.actionUrl),
    };
    if (typeof payload.notificationId === "string") result.tag = payload.notificationId;
    return { title: result.title, body: result.body, tag: result.tag, target: result.target };
  }

  var api = { CACHE_VERSION: CACHE_VERSION, getSafeTarget: getSafeTarget, parsePushPayload: parsePushPayload };
  root.BlueprintSW = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : globalThis);
