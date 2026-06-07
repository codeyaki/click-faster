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
  const SAVE_STATUS_MS = 900;

  const controls = {};
  let currentHost = "";
  let currentSettings = { ...DEFAULT_SETTINGS };
  let statusTimer = null;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    controls.enabled = document.querySelector("#enabled");
    controls.speedRange = document.querySelector("#speedRange");
    controls.speedNumber = document.querySelector("#speedNumber");
    controls.speedOutput = document.querySelector("#speedOutput");
    controls.showBadge = document.querySelector("#showBadge");
    controls.compatibilityMode = document.querySelector("#compatibilityMode");
    controls.siteToggle = document.querySelector("#siteToggle");
    controls.siteStatus = document.querySelector("#siteStatus");
    controls.reset = document.querySelector("#reset");
    controls.status = document.querySelector("#status");
    controls.modeRadios = [...document.querySelectorAll('input[name="mode"]')];

    bindEvents();
    Promise.all([loadSettings(), getCurrentTabHost()]).then(([settings, host]) => {
      currentHost = host;
      renderSettings(settings);
    });
  }

  function bindEvents() {
    controls.enabled.addEventListener("change", persistFromControls);
    controls.showBadge.addEventListener("change", persistFromControls);
    controls.compatibilityMode.addEventListener("change", persistFromControls);
    controls.speedRange.addEventListener("input", handleSpeedRangeInput);
    controls.speedNumber.addEventListener("input", handleSpeedNumberInput);
    controls.siteToggle.addEventListener("click", toggleCurrentSite);
    controls.reset.addEventListener("click", resetSettings);

    for (const radio of controls.modeRadios) {
      radio.addEventListener("change", persistFromControls);
    }
  }

  function handleSpeedRangeInput() {
    setSpeedControls(controls.speedRange.value);
    persistFromControls();
  }

  function handleSpeedNumberInput() {
    setSpeedControls(controls.speedNumber.value);
    persistFromControls();
  }

  function loadSettings() {
    const extensionApi = getExtensionApi();

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

  function saveSettings(settings) {
    const normalizedSettings = normalizeSettings(settings);
    const extensionApi = getExtensionApi();

    if (!extensionApi) {
      renderStatus("미리보기");
      return Promise.resolve();
    }

    if (extensionApi.promiseBased) {
      return extensionApi.api.storage.sync.set(normalizedSettings).then(() => renderStatus("저장됨")).catch(() => renderStatus("오류"));
    }

    return new Promise((resolve) => {
      extensionApi.api.storage.sync.set(normalizedSettings, () => {
        renderStatus(extensionApi.api.runtime?.lastError ? "오류" : "저장됨");
        resolve();
      });
    });
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

  function getCurrentTabHost() {
    const extensionApi = getExtensionApi();

    if (!extensionApi?.api?.tabs?.query) {
      return Promise.resolve(normalizeHost(globalThis.location?.hostname ?? ""));
    }

    if (extensionApi.promiseBased) {
      return extensionApi.api.tabs.query({ active: true, currentWindow: true })
        .then((tabs) => normalizeHostFromUrl(tabs?.[0]?.url))
        .catch(() => "");
    }

    return new Promise((resolve) => {
      extensionApi.api.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (extensionApi.api.runtime?.lastError) {
          resolve("");
          return;
        }

        resolve(normalizeHostFromUrl(tabs?.[0]?.url));
      });
    });
  }

  function persistFromControls() {
    saveSettings(readControls());
  }

  function resetSettings() {
    renderSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }

  function readControls() {
    const checkedMode = controls.modeRadios.find((radio) => radio.checked)?.value ?? DEFAULT_SETTINGS.mode;

    return {
      enabled: controls.enabled.checked,
      speed: Number(controls.speedNumber.value),
      mode: checkedMode,
      showBadge: controls.showBadge.checked,
      compatibilityMode: controls.compatibilityMode.checked,
      disabledHosts: currentSettings.disabledHosts
    };
  }

  function renderSettings(settings) {
    const normalizedSettings = normalizeSettings(settings);
    currentSettings = normalizedSettings;
    controls.enabled.checked = normalizedSettings.enabled;
    controls.showBadge.checked = normalizedSettings.showBadge;
    controls.compatibilityMode.checked = normalizedSettings.compatibilityMode;
    setSpeedControls(normalizedSettings.speed);

    for (const radio of controls.modeRadios) {
      radio.checked = radio.value === normalizedSettings.mode;
    }

    renderSiteStatus(normalizedSettings);
  }

  function renderSiteStatus(settings) {
    if (!currentHost) {
      controls.siteToggle.disabled = true;
      controls.siteToggle.textContent = "현재 사이트 확인 불가";
      controls.siteStatus.textContent = "";
      return;
    }

    const disabled = isHostDisabled(currentHost, settings.disabledHosts);
    controls.siteToggle.disabled = false;
    controls.siteToggle.textContent = disabled ? "현재 사이트에서 켜기" : "현재 사이트에서 끄기";
    controls.siteStatus.textContent = disabled ? `${currentHost} 제외됨` : currentHost;
  }

  function toggleCurrentSite() {
    if (!currentHost) {
      return;
    }

    const disabledHosts = currentSettings.disabledHosts.filter((host) => !hostMatches(currentHost, host));

    if (!isHostDisabled(currentHost, currentSettings.disabledHosts)) {
      disabledHosts.push(currentHost);
    }

    const nextSettings = {
      ...readControls(),
      disabledHosts: [...new Set(disabledHosts.map(normalizeHost).filter(Boolean))]
    };

    renderSettings(nextSettings);
    saveSettings(nextSettings);
  }

  function setSpeedControls(speed) {
    const normalizedSpeed = normalizeSpeed(speed);
    const formattedSpeed = formatSpeed(normalizedSpeed);

    controls.speedRange.value = normalizedSpeed;
    controls.speedNumber.value = normalizedSpeed;
    controls.speedOutput.value = `${formattedSpeed}x`;
    controls.speedOutput.textContent = `${formattedSpeed}x`;
  }

  function renderStatus(message) {
    controls.status.textContent = message;

    if (statusTimer) {
      clearTimeout(statusTimer);
    }

    statusTimer = setTimeout(() => {
      controls.status.textContent = "";
    }, SAVE_STATUS_MS);
  }

  function normalizeSettings(rawSettings = {}) {
    const disabledHosts = Array.isArray(rawSettings.disabledHosts)
      ? [...new Set(rawSettings.disabledHosts.map(normalizeHost).filter(Boolean))]
      : [];

    return {
      enabled: rawSettings.enabled !== false,
      speed: normalizeSpeed(rawSettings.speed),
      mode: rawSettings.mode === "toggle" ? "toggle" : "hold",
      showBadge: rawSettings.showBadge !== false,
      compatibilityMode: rawSettings.compatibilityMode !== false,
      disabledHosts
    };
  }

  function normalizeSpeed(speed) {
    const numberSpeed = Number(speed);
    const finiteSpeed = Number.isFinite(numberSpeed) ? numberSpeed : DEFAULT_SETTINGS.speed;

    return Math.round(clamp(finiteSpeed, MIN_SPEED, MAX_SPEED) * 10) / 10;
  }

  function formatSpeed(speed) {
    return Number(speed).toFixed(1).replace(/\.0$/, "");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeHostFromUrl(url) {
    try {
      return normalizeHost(new URL(url).hostname);
    } catch {
      return "";
    }
  }

  function normalizeHost(hostname) {
    return String(hostname ?? "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "")
      .replace(/^www\./, "");
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
})();
