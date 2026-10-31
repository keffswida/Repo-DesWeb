/* Timer — fokus, istirahat, kontrol, pencatatan sesi.
 *
 * Aturan inti dari dokumen konsep:
 *  - Waktu dihitung dari endAt (timestamp), bukan pengurangan detik.
 *    Browser menunda setInterval saat tab tidak aktif, jadi angka
 *    yang dikurangi per detik akan meleset. Timestamp tidak.
 *  - Pause membekukan sisa waktu; waktu tidak boleh terus berkurang.
 *  - Reset membatalkan sesi; sesi yang belum selesai tidak dicatat.
 *  - Sesi selesai dicatat tepat satu kali.
 */

(function (global) {
  "use strict";

  var U = global.Utils;
  var $ = U.$;
  var $$ = U.$$;

  var TICK_MS = 250;

  // Keliling lingkaran progres. Dihitung ulang dari atribut r saat init
  // supaya kalau r diubah di HTML, offset tetap akurat tanpa hitung tangan.
  var circumference = 603.19;

  var tickHandle = null;

  /* ---------------------------------------------------------------- */
  /* BACA                                                             */
  /* ---------------------------------------------------------------- */

  function getTimer() {
    return global.Store.getState().timer;
  }

  function getSettings() {
    return global.Store.getState().settings;
  }

  function isRunning(timer) {
    return Boolean(timer && timer.running);
  }

  function isPaused(timer) {
    return Boolean(timer && !timer.running && timer.remainingMs != null);
  }

  function isIdle(timer) {
    return !isRunning(timer) && !isPaused(timer);
  }

  /** Total durasi mode ini dalam milidetik. */
  function totalMs(mode) {
    var settings = getSettings();
    var minutes = mode === "break" ? settings.breakMin : settings.focusMin;

    return minutes * 60000;
  }

  /**
   * Sisa waktu. Satu-satunya sumber kebenaran adalah endAt bila berjalan,
   * jadi tab yang tertunda tetap menghasilkan angka benar.
   */
  function remainingMs() {
    var timer = getTimer();

    if (!timer) {
      return null;
    }

    if (isRunning(timer)) {
      return Math.max(0, timer.endAt - Date.now());
    }

    if (isPaused(timer)) {
      return timer.remainingMs;
    }

    // Idle: baca pengaturan terkini, bukan salinan lama di timer,
    // supaya display ikut berubah saat user mengedit durasi.
    return totalMs(timer.mode);
  }

  /* ---------------------------------------------------------------- */
  /* SUARA                                                            */
  /* ---------------------------------------------------------------- */

  /** Bunyi pendek tanpa file aset — memakai Web Audio API. */
  function beep(frequency, duration) {
    if (!getSettings().sound) {
      return;
    }

    try {
      var AudioCtx = global.AudioContext || global.webkitAudioContext;

      if (!AudioCtx) {
        return;
      }

      var ctx = new AudioCtx();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var now = ctx.currentTime;

      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency || 880, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (duration || 0.5));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + (duration || 0.5) + 0.05);

      osc.onended = function () {
        if (typeof ctx.close === "function") {
          ctx.close();
        }
      };
    } catch (error) {
      // Audio diblokir kebijakan browser (autoplay). Bukan fatal.
    }
  }

  /** Hitung keliling dari atribut r lingkaran progres. */
  function measureRing() {
    var circle = $("#timer-progress");

    if (!circle) {
      return;
    }

    var r = parseFloat(circle.getAttribute("r"));

    if (Number.isNaN(r) || r <= 0) {
      return;
    }

    circumference = 2 * Math.PI * r;

    // Samakan dasharray dengan keliling yang benar. Nilai di HTML
    // adalah perkiraan; ini memastikan offset 0 = lingkaran penuh.
    circle.setAttribute("stroke-dasharray", String(Math.round(circumference * 100) / 100));
  }

  /* ---------------------------------------------------------------- */
  /* KONTROL                                                          */
  /* ---------------------------------------------------------------- */

  function start() {
    var mode = getTimer() ? getTimer().mode : "focus";
    var active = global.Tasks.getActive();

    if (mode === "focus" && !active) {
      U.toast("Pilih satu tugas sebelum memulai timer.");
      return false;
    }

    var minutes = mode === "break" ? getSettings().breakMin : getSettings().focusMin;
    var now = Date.now();

    var ok = global.Store.update(function (s) {
      s.timer = {
        mode: mode,
        // Snapshot dipasang di sini. Kalau tugas dihapus di tengah
        // sesi, riwayat tetap punya nama yang benar.
        taskId: mode === "focus" && active ? active.id : null,
        taskTitle: mode === "focus" && active ? active.title : null,
        durationMin: minutes,
        endAt: now + minutes * 60000,
        remainingMs: null,
        running: true,
        sessionRecorded: false,
        startedAt: new Date(now).toISOString()
      };
    });

    if (ok) {
      U.toast(mode === "break" ? "Istirahat dimulai" : "Sesi fokus dimulai");
    }

    return ok;
  }

  function pause() {
    var timer = getTimer();

    if (!isRunning(timer)) {
      return false;
    }

    var left = Math.max(0, timer.endAt - Date.now());

    // Tenggat sudah lewat saat sempat ditekan — langsung selesaikan,
    // jangan simpan sisa 0 yang berarti sesi tidak pernah tercatat.
    if (left <= 0) {
      complete();
      return false;
    }

    return global.Store.update(function (s) {
      s.timer.endAt = null;
      s.timer.remainingMs = left;
      s.timer.running = false;
    });
  }

  function resume() {
    var timer = getTimer();

    if (!isPaused(timer)) {
      return false;
    }

    var left = timer.remainingMs;

    return global.Store.update(function (s) {
      s.timer.endAt = Date.now() + left;
      s.timer.remainingMs = null;
      s.timer.running = true;
    });
  }

  /** Batalkan sesi. Sesi yang belum selesai tidak dicatat. */
  function reset() {
    var timer = getTimer();

    if (isIdle(timer)) {
      return false;
    }

    return global.Store.update(function (s) {
      s.timer = null;
    });
  }

  /**
   * Ganti mode. Hanya boleh saat timer idle — mengganti mode di
   * tengah sesi akan membuat durasi dan sisa waktu tidak konsisten.
   *
   * Saat timer masih null, objek timer idle dibuat lebih dulu supaya
   * mode punya tempat disimpan. Tanpa ini setMode akan melapor sukses
   * padahal tidak menyentuh apa pun.
   */
  function setMode(mode) {
    var next = mode === "break" ? "break" : "focus";
    var timer = getTimer();

    if (timer && !isIdle(timer)) {
      U.toast("Selesaikan atau reset timer dulu sebelum ganti mode.");
      return false;
    }

    return global.Store.update(function (s) {
      var durationMin =
        next === "break" ? s.settings.breakMin : s.settings.focusMin;

      if (!s.timer) {
        s.timer = {
          mode: next,
          taskId: null,
          taskTitle: null,
          durationMin: durationMin,
          endAt: null,
          remainingMs: null,
          running: false,
          sessionRecorded: false,
          startedAt: null
        };
        return;
      }

      s.timer.mode = next;
      s.timer.durationMin = durationMin;
    });
  }

  /**
   * Sesi selesai. sessionRecorded dikunci di dalam update yang sama
   * dengan pemasukan sesi, sehingga tidak mungkin tercatat dua kali
   * walau dipanggil berulang.
   */
  function complete() {
    var timer = getTimer();

    if (!timer) {
      return false;
    }

    var recorded = false;
    var wasFocus = timer.mode === "focus";

    global.Store.update(function (s) {
      if (s.timer && !s.timer.sessionRecorded) {
        s.timer.sessionRecorded = true;

        if (s.timer.mode === "focus" && s.timer.taskTitle) {
          s.sessions.push({
            id: U.uid("s"),
            taskId: s.timer.taskId,
            taskTitle: s.timer.taskTitle,
            durationMin: s.timer.durationMin,
            completedAt: new Date().toISOString()
          });
          recorded = true;
        }
      }

      s.timer = null;
    });

    beep(wasFocus ? 880 : 660, 0.5);

    if (recorded) {
      U.toast("Sesi fokus tercatat · " + U.formatDuration(timer.durationMin));
    } else {
      U.toast(wasFocus ? "Sesi fokus selesai" : "Istirahat selesai");
    }

    return true;
  }

  /* ---------------------------------------------------------------- */
  /* TICK                                                             */
  /* ---------------------------------------------------------------- */

  function tick() {
    var timer = getTimer();

    if (!timer) {
      stopTick();
      render();
      return;
    }

    if (isRunning(timer) && timer.endAt <= Date.now()) {
      complete();
      return;
    }

    render();
  }

  function stopTick() {
    if (tickHandle !== null) {
      global.clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  /** Idempoten: mulai interval hanya saat timer berjalan. */
  function syncTick() {
    if (isRunning(getTimer())) {
      if (tickHandle === null) {
        tickHandle = global.setInterval(tick, TICK_MS);
      }
      return;
    }

    stopTick();
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                           */
  /* ---------------------------------------------------------------- */

  function render() {
    var timer = getTimer();
    var display = $("#timer-display");
    var status = $("#timer-status");
    var progress = $("#timer-progress");
    var modeLabel = $("#timer-mode-label");

    var mode = timer ? timer.mode : "focus";
    var left = remainingMs();
    var total = isIdle(timer) ? totalMs(mode) : timer.durationMin * 60000;

    U.setText(display, U.formatClockFromMs(left == null ? total : left));
    U.setText(modeLabel, mode === "break" ? "Waktu istirahat" : "Waktu fokus");

    renderRing(progress, left, total);
    renderModeButtons(timer, mode);
    renderControls(timer, left);

    renderStatus(status, timer, mode);

    // Sinkronkan interval di sini, bukan di init() saja. start(), resume(),
    // pause(), dan reset() semuanya melewati render() lewat Store.subscribe,
    // jadi satu panggilan di sini menjamin interval selalu ikut status
    // timer — termasuk setelah klik Start tanpa refresh halaman.
    // syncTick() idempoten: aman dipanggil berulang tiap tick.
    syncTick();
  }

  function renderRing(progress, left, total) {
    if (!progress) {
      return;
    }

    var fraction = total > 0 && left != null ? Math.max(0, Math.min(1, left / total)) : 1;
    var offset = circumference * (1 - fraction);

    progress.setAttribute("stroke-dashoffset", String(Math.round(offset * 100) / 100));
  }

  function renderModeButtons(timer, mode) {
    var locked = Boolean(timer) && !isIdle(timer);

    $$(".mode-btn").forEach(function (btn) {
      var isActive = btn.getAttribute("data-mode") === mode;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
      btn.disabled = locked;
    });
  }

  function renderControls(timer, left) {
    var activeExists = Boolean(global.Tasks.getActive());
    var running = isRunning(timer);
    var paused = isPaused(timer);
    var canStart = activeExists && !running && !paused;

    // Idle di mode istirahat tidak butuh tugas.
    if (timer && timer.mode === "break") {
      canStart = !running && !paused;
    }

    setDisabled("#timer-start", !canStart);
    setDisabled("#timer-pause", !running);
    setDisabled("#timer-resume", !paused);
    setDisabled("#timer-reset", isIdle(timer));
  }

  function setDisabled(selector, disabled) {
    var el = $(selector);

    if (el) {
      el.disabled = Boolean(disabled);
    }
  }

  function renderStatus(status, timer, mode) {
    if (!status) {
      return;
    }

    if (!timer) {
      U.setText(
        status,
        mode === "break"
          ? "Istirahat belum dimulai."
          : global.Tasks.getActive()
            ? "Siap memulai sesi fokus."
            : "Pilih tugas terlebih dahulu."
      );
      return;
    }

    if (isRunning(timer)) {
      U.setText(
        status,
        mode === "break"
          ? "Istirahat berjalan."
          : "Sesi fokus berjalan untuk " + timer.taskTitle + "."
      );
      return;
    }

    U.setText(status, "Timer dijeda. Waktu tidak berkurang sampai dilanjutkan.");
  }

  /* ---------------------------------------------------------------- */
  /* EVENT                                                            */
  /* ---------------------------------------------------------------- */

  function onModeClick(event) {
    var btn = event.target.closest(".mode-btn");

    if (btn) {
      setMode(btn.getAttribute("data-mode"));
    }
  }

  function bind(selector, handler) {
    var el = $(selector);

    if (el) {
      el.addEventListener("click", handler);
    }
  }

  function init() {
    measureRing();

    bind("#timer-start", start);
    bind("#timer-pause", pause);
    bind("#timer-resume", resume);
    bind("#timer-reset", reset);

    var modeSwitch = $(".mode-switch");
    if (modeSwitch) {
      modeSwitch.addEventListener("click", onModeClick);
    }

    // Tab tertunda tidak menjalankan interval. Begitu tab terlihat
    // lagi, hitung ulang dari endAt supaya tidak ada sesi yang lolos.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        tick();
      }
    });

    // Timer berjalan saat halaman dibuka (misal refresh): pastikan
    // interval hidup dan tenggat yang sudah lewat langsung diselesaikan.
    var timer = getTimer();

    if (timer && isRunning(timer)) {
      if (timer.endAt <= Date.now()) {
        complete();
      } else {
        syncTick();
      }
    }

    render();
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.Timer = {
    init: init,
    render: render,
    start: start,
    pause: pause,
    resume: resume,
    reset: reset,
    setMode: setMode,
    complete: complete,
    remainingMs: remainingMs,
    isRunning: isRunning,
    isPaused: isPaused,
    isIdle: isIdle
  };
})(window);
