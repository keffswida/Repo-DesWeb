/* Settings — durasi timer, suara, dan pengelolaan data. */

(function (global) {
  "use strict";

  var U = global.Utils;
  var $ = U.$;

  var LIMITS = {
    focusMin: { min: 1, max: 120, fallback: 25 },
    breakMin: { min: 1, max: 60, fallback: 5 }
  };

  /* ---------------------------------------------------------------- */
  /* BACA                                                             */
  /* ---------------------------------------------------------------- */

  function getSettings() {
    return global.Store.getState().settings;
  }

  /** Baca angka dari input, potong ke rentang yang sah. */
  function readMinutes(input, limits) {
    var value = parseInt(input.value, 10);

    if (Number.isNaN(value) || value <= 0) {
      input.value = String(limits.fallback);
      return limits.fallback;
    }

    var clamped = U.clamp(value, limits.min, limits.max);

    // Tulis balik hasil pangkasan supaya user melihat nilai final,
    // bukan angka yang diam-diam dipotong.
    input.value = String(clamped);

    return clamped;
  }

  /* ---------------------------------------------------------------- */
  /* TULIS                                                            */
  /* ---------------------------------------------------------------- */

  function save() {
    var focusInput = $("#setting-focus");
    var breakInput = $("#setting-break");
    var soundInput = $("#setting-sound");

    if (!focusInput || !breakInput || !soundInput) {
      return false;
    }

    var focusMin = readMinutes(focusInput, LIMITS.focusMin);
    var breakMin = readMinutes(breakInput, LIMITS.breakMin);
    var sound = soundInput.checked;

    var ok = global.Store.update(function (s) {
      s.settings.focusMin = focusMin;
      s.settings.breakMin = breakMin;
      s.settings.sound = sound;
    });

    if (ok) {
      U.toast("Pengaturan disimpan");
    }

    return ok;
  }

  function restoreDefaults() {
    var ok = global.Store.resetSettings();

    if (ok) {
      U.toast("Pengaturan dikembalikan ke default");
    }

    return ok;
  }

  /**
   * Hapus semua data. Berbeda dengan resetSettings: tugas, riwayat,
   * dan pengaturan semuanya hilang.
   */
  function wipeAllData() {
    var state = global.Store.getState();
    var taskCount = state.tasks.length;
    var sessionCount = state.sessions.length;

    if (taskCount === 0 && sessionCount === 0) {
      U.toast("Tidak ada data untuk dihapus");
      return false;
    }

    U.confirmDialog({
      title: "Hapus semua data",
      message:
        taskCount +
        " tugas dan " +
        sessionCount +
        " sesi riwayat akan dihapus permanen dari browser ini. " +
        "Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Hapus semua data"
    }).then(function (ok) {
      if (!ok) {
        return;
      }

      global.Store.clear();
      U.toast("Semua data dihapus");
    });

    return true;
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                            */
  /* ---------------------------------------------------------------- */

  /** Isi form dari state. Dipanggil saat load dan setelah perubahan. */
  function render() {
    var settings = getSettings();
    var focusInput = $("#setting-focus");
    var breakInput = $("#setting-break");
    var soundInput = $("#setting-sound");

    if (focusInput) {
      focusInput.value = String(settings.focusMin);
    }

    if (breakInput) {
      breakInput.value = String(settings.breakMin);
    }

    if (soundInput) {
      soundInput.checked = settings.sound;
    }
  }

  /* ---------------------------------------------------------------- */
  /* EVENT                                                             */
  /* ---------------------------------------------------------------- */

  function onFormSubmit(event) {
    event.preventDefault();
    save();
  }

  function init() {
    var form = $("#settings-form");

    if (form) {
      form.addEventListener("submit", onFormSubmit);
    }

    var defaultBtn = $("#settings-default");
    if (defaultBtn) {
      defaultBtn.addEventListener("click", restoreDefaults);
    }

    var wipeBtn = $("#data-reset");
    if (wipeBtn) {
      wipeBtn.addEventListener("click", wipeAllData);
    }

    render();
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.Settings = {
    init: init,
    render: render,
    save: save,
    restoreDefaults: restoreDefaults,
    wipeAllData: wipeAllData,
    LIMITS: LIMITS
  };
})(window);
