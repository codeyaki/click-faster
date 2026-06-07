(() => {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    speed: 2,
    mode: "hold",
    showBadge: true,
    compatibilityMode: true,
    disabledHosts: []
  });

  const MIN_SPEED = 1;
  const MAX_SPEED = 16;
  const HOLD_CLICK_SUPPRESS_MS = 220;
  const CLICK_SUPPRESS_WINDOW_MS = 700;
  const BADGE_HIDE_MS = 500;
  const COMPATIBILITY_RULES = Object.freeze([
    {
      hosts: ["netflix.com"],
      maxSpeed: 1.5
    }
  ]);

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    activePointers: new Map(),
    holdRates: new Map(),
    toggleRates: new Map(),
    suppressClick: null,
    badge: null,
    badgeTimer: null
  };

  const extensionApi = getExtensionApi();

  initialize();

  function initialize() {
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerEnd, true);
    document.addEventListener("pointercancel", handlePointerEnd, true);
    document.addEventListener("lostpointercapture", handlePointerEnd, true);
    document.addEventListener("click", handleClick, true);

    loadSettings().then(applySettings);
    subscribeSettings();
  }

  function getExtensionApi() {
    if (globalThis.browser?.storage?.sync) {
      return { api: globalThis.browser, promiseBased: true };
    }

    if (globalThis.chrome?.storage?.sync) {
      return { api: globalThis.chrome, promiseBased: false };
    }

    return null;
  }

  function loadSettings() {
    if (!extensionApi) {
      return Promise.resolve({ ...DEFAULT_SETTINGS });
    }

    if (extensionApi.promiseBased) {
      return extensionApi.api.storage.sync.get(DEFAULT_SETTINGS).then(normalizeSettings).catch(() => ({ ...DEFAULT_SETTINGS }));
    }

    return new Promise((resolve) => {
      extensionApi.api.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        if (extensionApi.api.runtime?.lastError) {
          resolve({ ...DEFAULT_SETTINGS });
          return;
        }

        resolve(normalizeSettings(items));
      });
    });
  }

  function subscribeSettings() {
    const onChanged = extensionApi?.api?.storage?.onChanged;

    if (!onChanged?.addListener) {
      return;
    }

    onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      const nextSettings = { ...state.settings };

      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (Object.prototype.hasOwnProperty.call(changes, key)) {
          nextSettings[key] = changes[key].newValue;
        }
      }

      applySettings(nextSettings);
    });
  }

  function normalizeSettings(rawSettings = {}) {
    const speed = Number(rawSettings.speed);
    const mode = rawSettings.mode === "toggle" ? "toggle" : "hold";
    const disabledHosts = Array.isArray(rawSettings.disabledHosts)
      ? [...new Set(rawSettings.disabledHosts.map(normalizeHost).filter(Boolean))]
      : [];

    return {
      enabled: rawSettings.enabled !== false,
      speed: clamp(Number.isFinite(speed) ? speed : DEFAULT_SETTINGS.speed, MIN_SPEED, MAX_SPEED),
      mode,
      showBadge: rawSettings.showBadge !== false,
      compatibilityMode: rawSettings.compatibilityMode !== false,
      disabledHosts
    };
  }

  function applySettings(nextSettings) {
    const previousMode = state.settings.mode;
    const wasActive = isExtensionActive();
    state.settings = normalizeSettings(nextSettings);
    const isActive = isExtensionActive();

    if (!isActive || previousMode !== state.settings.mode || wasActive !== isActive) {
      restoreAllVideos();
    }

    if (isActive) {
      updateActiveRates();
    }
  }

  function handlePointerDown(event) {
    if (!isExtensionActive() || state.settings.mode !== "hold" || isNonPrimaryMouseButton(event)) {
      return;
    }

    const video = findVideoFromEvent(event);

    if (!video) {
      return;
    }

    const pointerId = getPointerId(event);
    state.activePointers.set(pointerId, {
      video,
      startedAt: Date.now()
    });

    setFastRate(video, state.holdRates);
    showSpeedBadge(video);
  }

  function handlePointerEnd(event) {
    const pointerId = getPointerId(event);
    const activePointer = state.activePointers.get(pointerId);

    if (!activePointer) {
      return;
    }

    state.activePointers.delete(pointerId);

    if (!hasActivePointerForVideo(activePointer.video)) {
      restoreRate(activePointer.video, state.holdRates);
    }

    if (Date.now() - activePointer.startedAt >= HOLD_CLICK_SUPPRESS_MS) {
      state.suppressClick = {
        video: activePointer.video,
        expiresAt: Date.now() + CLICK_SUPPRESS_WINDOW_MS
      };
    }
  }

  function handleClick(event) {
    if (!isExtensionActive()) {
      return;
    }

    if (state.settings.mode === "hold") {
      if (shouldSuppressClick(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }

      return;
    }

    const video = findVideoFromEvent(event);

    if (!video) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    toggleFastRate(video);
    showSpeedBadge(video);
  }

  function setFastRate(video, rateMap) {
    if (!rateMap.has(video)) {
      rateMap.set(video, video.playbackRate);
    }

    setPlaybackRate(video, getEffectiveSpeed());
  }

  function toggleFastRate(video) {
    if (state.toggleRates.has(video)) {
      restoreRate(video, state.toggleRates);
      hideSpeedBadgeSoon();
      return;
    }

    setFastRate(video, state.toggleRates);
  }

  function restoreRate(video, rateMap) {
    if (!rateMap.has(video)) {
      return;
    }

    const previousRate = rateMap.get(video);
    rateMap.delete(video);
    restorePlaybackRate(video, previousRate);
    hideSpeedBadgeSoon();
  }

  function restoreAllVideos() {
    for (const [video, previousRate] of state.holdRates) {
      restorePlaybackRate(video, previousRate);
    }

    for (const [video, previousRate] of state.toggleRates) {
      restorePlaybackRate(video, previousRate);
    }

    state.activePointers.clear();
    state.holdRates.clear();
    state.toggleRates.clear();
    hideSpeedBadgeSoon();
  }

  function updateActiveRates() {
    for (const video of state.holdRates.keys()) {
      setPlaybackRate(video, getEffectiveSpeed());
    }

    for (const video of state.toggleRates.keys()) {
      setPlaybackRate(video, getEffectiveSpeed());
    }
  }

  function setPlaybackRate(video, playbackRate) {
    try {
      video.playbackRate = clamp(Number(playbackRate), MIN_SPEED, MAX_SPEED);
      return true;
    } catch {
      return false;
    }
  }

  function restorePlaybackRate(video, playbackRate) {
    try {
      video.playbackRate = Number(playbackRate);
      return true;
    } catch {
      return false;
    }
  }

  function hasActivePointerForVideo(video) {
    for (const activePointer of state.activePointers.values()) {
      if (activePointer.video === video) {
        return true;
      }
    }

    return false;
  }

  function isExtensionActive() {
    return state.settings.enabled && !isHostDisabled(getCurrentHostname(), state.settings.disabledHosts);
  }

  function getEffectiveSpeed(settings = state.settings, hostname = getCurrentHostname()) {
    const normalizedSettings = normalizeSettings(settings);
    const rule = normalizedSettings.compatibilityMode ? getCompatibilityRule(hostname) : null;
    const maxSpeed = rule?.maxSpeed ?? MAX_SPEED;

    return clamp(normalizedSettings.speed, MIN_SPEED, maxSpeed);
  }

  function getCompatibilityRule(hostname = getCurrentHostname()) {
    const normalizedHostname = normalizeHost(hostname);

    return COMPATIBILITY_RULES.find((rule) => rule.hosts.some((host) => hostMatches(normalizedHostname, host))) ?? null;
  }

  function isHostDisabled(hostname, disabledHosts = []) {
    const normalizedHostname = normalizeHost(hostname);

    if (!normalizedHostname) {
      return false;
    }

    return disabledHosts.map(normalizeHost).filter(Boolean).some((host) => hostMatches(normalizedHostname, host));
  }

  function hostMatches(hostname, targetHost) {
    return hostname === targetHost || hostname.endsWith(`.${targetHost}`);
  }

  function getCurrentHostname() {
    return normalizeHost(globalThis.location?.hostname ?? "");
  }

  function normalizeHost(hostname) {
    return String(hostname ?? "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "")
      .replace(/^www\./, "");
  }

  function shouldSuppressClick(event) {
    if (!state.suppressClick || Date.now() > state.suppressClick.expiresAt) {
      state.suppressClick = null;
      return false;
    }

    const video = findVideoFromEvent(event);

    const shouldSuppress = video === state.suppressClick.video;

    if (shouldSuppress) {
      state.suppressClick = null;
    }

    return shouldSuppress;
  }

  function findVideoFromEvent(event) {
    const pathVideo = findVideoInPath(event);

    if (pathVideo && isUsableVideo(pathVideo)) {
      return pathVideo;
    }

    const point = getEventPoint(event);

    if (!point) {
      return null;
    }

    return findVideoAtPoint(point);
  }

  function findVideoInPath(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];

    for (const node of path) {
      if (isVideoElement(node)) {
        return node;
      }
    }

    return null;
  }

  function findVideoAtPoint(point) {
    const directElement = document.elementFromPoint(point.x, point.y);
    const directVideo = closestVideo(directElement);

    if (directVideo && isUsableVideo(directVideo)) {
      return directVideo;
    }

    const videos = collectVideos(document);
    const containingVideos = videos
      .filter((video) => isUsableVideo(video) && isPointInsideRect(point, video.getBoundingClientRect()))
      .sort((first, second) => getRectArea(first.getBoundingClientRect()) - getRectArea(second.getBoundingClientRect()));

    return containingVideos[0] ?? null;
  }

  function collectVideos(root) {
    const videos = [];

    if (!root?.querySelectorAll) {
      return videos;
    }

    for (const video of root.querySelectorAll("video")) {
      videos.push(video);
    }

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) {
        videos.push(...collectVideos(element.shadowRoot));
      }
    }

    return videos;
  }

  function closestVideo(node) {
    let current = node;

    while (current) {
      if (isVideoElement(current)) {
        return current;
      }

      if (current.parentElement) {
        current = current.parentElement;
        continue;
      }

      const rootNode = current.getRootNode?.();
      current = rootNode?.host ?? null;
    }

    return null;
  }

  function isVideoElement(node) {
    return Boolean(node?.tagName && node.tagName.toLowerCase() === "video");
  }

  function isUsableVideo(video) {
    const rect = video.getBoundingClientRect();
    const style = globalThis.getComputedStyle?.(video);

    return (
      rect.width >= 24 &&
      rect.height >= 24 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < globalThis.innerHeight &&
      rect.left < globalThis.innerWidth &&
      style?.display !== "none" &&
      style?.visibility !== "hidden" &&
      Number(style?.opacity ?? 1) !== 0
    );
  }

  function getEventPoint(event) {
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      return { x: event.clientX, y: event.clientY };
    }

    const touch = event.touches?.[0] ?? event.changedTouches?.[0];

    if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
      return { x: touch.clientX, y: touch.clientY };
    }

    return null;
  }

  function getPointerId(event) {
    return event.pointerId ?? "mouse";
  }

  function isNonPrimaryMouseButton(event) {
    return event.pointerType === "mouse" && event.button !== 0;
  }

  function isPointInsideRect(point, rect) {
    return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
  }

  function getRectArea(rect) {
    return rect.width * rect.height;
  }

  function showSpeedBadge(video) {
    if (!state.settings.showBadge) {
      return;
    }

    const badge = ensureBadge();
    const rect = video.getBoundingClientRect();

    badge.textContent = `${formatSpeed(getEffectiveSpeed())}x`;
    badge.style.left = `${Math.max(8, rect.left + 12)}px`;
    badge.style.top = `${Math.max(8, rect.top + 12)}px`;
    badge.hidden = false;
    badge.dataset.visible = "true";

    if (state.badgeTimer) {
      clearTimeout(state.badgeTimer);
      state.badgeTimer = null;
    }
  }

  function ensureBadge() {
    if (state.badge?.isConnected) {
      return state.badge;
    }

    const badge = document.createElement("div");
    badge.id = "click-faster-speed-badge";
    badge.hidden = true;
    badge.setAttribute("aria-hidden", "true");
    Object.assign(badge.style, {
      position: "fixed",
      zIndex: "2147483647",
      padding: "6px 10px",
      borderRadius: "999px",
      background: "rgba(12, 18, 28, 0.86)",
      color: "#ffffff",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      fontSize: "14px",
      fontWeight: "700",
      lineHeight: "1",
      pointerEvents: "none",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.22)"
    });

    (document.documentElement || document.body).append(badge);
    state.badge = badge;

    return badge;
  }

  function hideSpeedBadgeSoon() {
    if (!state.badge) {
      return;
    }

    if (state.badgeTimer) {
      clearTimeout(state.badgeTimer);
    }

    state.badgeTimer = setTimeout(() => {
      if (state.badge) {
        state.badge.hidden = true;
        state.badge.dataset.visible = "false";
      }
    }, BADGE_HIDE_MS);
  }

  function formatSpeed(speed) {
    return Number(speed).toFixed(1).replace(/\.0$/, "");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  if (globalThis.__CLICK_FASTER_TEST__) {
    globalThis.__CLICK_FASTER_TEST__.normalizeSettings = normalizeSettings;
    globalThis.__CLICK_FASTER_TEST__.findVideoAtPoint = findVideoAtPoint;
    globalThis.__CLICK_FASTER_TEST__.formatSpeed = formatSpeed;
    globalThis.__CLICK_FASTER_TEST__.getEffectiveSpeed = getEffectiveSpeed;
    globalThis.__CLICK_FASTER_TEST__.getCompatibilityRule = getCompatibilityRule;
    globalThis.__CLICK_FASTER_TEST__.isHostDisabled = isHostDisabled;
    globalThis.__CLICK_FASTER_TEST__.normalizeHost = normalizeHost;
  }
})();
