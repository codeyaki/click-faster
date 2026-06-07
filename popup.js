(() => {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    speed: 2,
    mode: "hold",
    showBadge: true
  });

  const MIN_SPEED = 1;
  const MAX_SPEED = 16;
  const SAVE_STATUS_MS = 900;

  const controls = {};
  let statusTimer = null;

  document.addEventListener("DOMContentLoaded", initialize);

  function initialize() {
    controls.enabled = document.querySelector("#enabled");
    controls.speedRange = document.querySelector("#speedRange");
    controls.speedNumber = document.querySelector("#speedNumber");
    controls.speedOutput = document.querySelector("#speedOutput");
    controls.showBadge = document.querySelector("#showBadge");
    controls.reset = document.querySelector("#reset");
    controls.status = document.querySelector("#status");
    controls.modeRadios = [...document.querySelectorAll('input[name="mode"]')];

    bindEvents();
    loadSettings().then(renderSettings);
  }

  function bindEvents() {
    controls.enabled.addEventListener("change", persistFromControls);
    controls.showBadge.addEventListener("change", persistFromControls);
    controls.speedRange.addEventListener("input", handleSpeedRangeInput);
    controls.speedNumber.addEventListener("input", handleSpeedNumberInput);
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
      showBadge: controls.showBadge.checked
    };
  }

  function renderSettings(settings) {
    const normalizedSettings = normalizeSettings(settings);
    controls.enabled.checked = normalizedSettings.enabled;
    controls.showBadge.checked = normalizedSettings.showBadge;
    setSpeedControls(normalizedSettings.speed);

    for (const radio of controls.modeRadios) {
      radio.checked = radio.value === normalizedSettings.mode;
    }
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
    return {
      enabled: rawSettings.enabled !== false,
      speed: normalizeSpeed(rawSettings.speed),
      mode: rawSettings.mode === "toggle" ? "toggle" : "hold",
      showBadge: rawSettings.showBadge !== false
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
})();
