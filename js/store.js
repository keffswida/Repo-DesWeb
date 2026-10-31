/* Store — satu-satunya tempat yang boleh menyentuh localStorage. */

(function (global) {
  "use strict";

  var STORAGE_KEY = "focusflow:v1";
  var SCHEMA_VERSION = 1;

  var DEFAULTS = {
    version: SCHEMA_VERSION,
    tasks: [],
    sessions: [],
    settings: {
      focusMin: 25,
      breakMin: 5,
      sound: true
    },
    activeTaskId: null,
    timer: null
  };

  var listeners = [];
  var state = null;

  /* ---------------------------------------------------------------- */
  /* DEFAULTS & SEED                                                   */
  /* ---------------------------------------------------------------- */

  /** Salinan default baru. Jangan pernah pakai DEFAULTS langsung. */
  function createDefaults() {
    return {
      version: DEFAULTS.version,
      tasks: [],
      sessions: [],
      settings: {
        focusMin: DEFAULTS.settings.focusMin,
        breakMin: DEFAULTS.settings.breakMin,
        sound: DEFAULTS.settings.sound
      },
      activeTaskId: null,
      timer: null
    };
  }

  /** Data contoh agar demonstrasi pertama tidak kosong. */
  function createSeed() {
    var seed = createDefaults();
    var now = Date.now();
    var HARI = 86400000;
    var JAM = 3600000;

    seed.tasks = [
      {
        id: global.Utils.uid("t"),
        title: "Baca materi CSS Grid",
        estimateMin: 45,
        done: false,
        createdAt: new Date(now - 2 * HARI).toISOString(),
        completedAt: null
      },
      {
        id: global.Utils.uid("t"),
        title: "Susun struktur HTML FocusFlow",
        estimateMin: 60,
        done: false,
        createdAt: new Date(now - HARI).toISOString(),
        completedAt: null
      },
      {
        id: global.Utils.uid("t"),
        title: "Rangkum catatan kuliah minggu ini",
        estimateMin: 30,
        done: true,
        createdAt: new Date(now - 3 * HARI).toISOString(),
        completedAt: new Date(now - 5 * JAM).toISOString()
      }
    ];

    seed.activeTaskId = seed.tasks[0].id;

    seed.sessions = [
      {
        id: global.Utils.uid("s"),
        taskId: seed.tasks[2].id,
        taskTitle: seed.tasks[2].title,
        durationMin: 25,
        completedAt: new Date(now - 5 * JAM).toISOString()
      },
      {
        id: global.Utils.uid("s"),
        taskId: seed.tasks[2].id,
        taskTitle: seed.tasks[2].title,
        durationMin: 20,
        completedAt: new Date(now - 6 * JAM).toISOString()
      }
    ];

    return seed;
  }

  /* ---------------------------------------------------------------- */
  /* NORMALISASI & MIGRASI                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Ubah jadi integer lalu batasi rentang. Nol atau negatif dianggap
   * "tidak pernah diisi" dan jatuh ke fallback. Dipakai untuk semua
   * durasi: timer yang tersimpan 0 berarti data rusak, bukan pilihan
   * user memakai durasi 1 menit.
   */
  function positiveInt(value, min, max, fallback) {
    var num = parseInt(value, 10);

    if (Number.isNaN(num) || num <= 0) {
      return fallback;
    }

    return global.Utils.clamp(num, min, max);
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /** Paksa objek hasil parse punya bentuk yang benar. */
  function normalize(raw) {
    var next = createDefaults();

    if (!raw || typeof raw !== "object") {
      return next;
    }

    next.settings.focusMin = positiveInt(raw.settings && raw.settings.focusMin, 1, 120, DEFAULTS.settings.focusMin);
    next.settings.breakMin = positiveInt(raw.settings && raw.settings.breakMin, 1, 60, DEFAULTS.settings.breakMin);
    next.settings.sound = typeof (raw.settings && raw.settings.sound) === "boolean"
      ? raw.settings.sound
      : DEFAULTS.settings.sound;

    next.tasks = asArray(raw.tasks)
      .filter(function (task) {
        return task && typeof task === "object" && typeof task.id === "string";
      })
      .map(function (task) {
        return {
          id: task.id,
          title: typeof task.title === "string" ? task.title : "",
          estimateMin: positiveInt(task.estimateMin, 1, 1440, 30),
          done: task.done === true,
          createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
          completedAt: typeof task.completedAt === "string" ? task.completedAt : null
        };
      });

    next.sessions = asArray(raw.sessions)
      .filter(function (session) {
        return session && typeof session === "object" && typeof session.id === "string";
      })
      .map(function (session) {
        return {
          id: session.id,
          taskId: typeof session.taskId === "string" ? session.taskId : null,
          // Snapshot judul: riwayat tetap terbaca walau tugas sudah dihapus.
          taskTitle: typeof session.taskTitle === "string" ? session.taskTitle : "Tugas tanpa judul",
          durationMin: positiveInt(session.durationMin, 1, 1440, 25),
          completedAt: typeof session.completedAt === "string" ? session.completedAt : new Date().toISOString()
        };
      });

    // activeTaskId harus menunjuk tugas yang benar-benar ada.
    var taskIds = next.tasks.map(function (task) {
      return task.id;
    });

    next.activeTaskId =
      typeof raw.activeTaskId === "string" && taskIds.indexOf(raw.activeTaskId) !== -1
        ? raw.activeTaskId
        : null;

    next.timer = normalizeTimer(raw.timer, next.tasks);

    return next;
  }

  /**
   * Timer boleh hilang, tapi bentuknya harus valid kalau ada.
   *
   * Menerima daftar task, bukan sekadar id, karena ada dua kasus:
   *  - tugas masih ada  -> judul diambil terbaru (user boleh rename)
   *  - tugas sudah dihapus -> jatuh ke snapshot taskTitle, sesi tetap
   *    bisa dicatat dengan nama yang benar
   */
  function normalizeTimer(raw, tasks) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    var mode = raw.mode === "break" ? "break" : "focus";
    var running = raw.running === true;

    var taskIds = (tasks || []).map(function (task) {
      return task.id;
    });

    var taskId =
      typeof raw.taskId === "string" && taskIds.indexOf(raw.taskId) !== -1 ? raw.taskId : null;

    var matched = null;

    (tasks || []).forEach(function (task) {
      if (task.id === taskId) {
        matched = task;
      }
    });

    var snapshot = typeof raw.taskTitle === "string" && raw.taskTitle.trim() !== ""
      ? raw.taskTitle.trim()
      : null;

    var taskTitle = matched ? matched.title : snapshot;

    // Mode fokus tanpa judul tugas tidak bisa menghasilkan sesi berguna.
    if (mode === "focus" && !taskTitle) {
      return null;
    }

    // Durasi timer wajib mengikuti batas pengaturan yang sesuai mode,
    // supaya timer tidak pernah menyimpan durasi di luar jangkauan form.
    var maxMinutes = mode === "focus" ? 120 : 60;
    var fallbackMinutes = mode === "focus"
      ? DEFAULTS.settings.focusMin
      : DEFAULTS.settings.breakMin;

    return {
      mode: mode,
      taskId: taskId,
      taskTitle: taskTitle,
      durationMin: positiveInt(raw.durationMin, 1, maxMinutes, fallbackMinutes),
      endAt: typeof raw.endAt === "number" && raw.endAt > 0 ? raw.endAt : null,
      remainingMs: typeof raw.remainingMs === "number" && raw.remainingMs > 0 ? raw.remainingMs : null,
      running: running,
      sessionRecorded: raw.sessionRecorded === true,
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : null
    };
  }

  /**
   * Jalankan rantai migrasi bila versi tersimpan lebih lama.
   * Tambah langkah baru di sini saat skema berubah.
   */
  function migrate(raw) {
    var data = raw && typeof raw === "object" ? raw : null;

    if (!data) {
      return null;
    }

    var from = typeof data.version === "number" ? data.version : 1;

    if (from > SCHEMA_VERSION) {
      // Versi lebih baru dari aplikasi ini. Jangan rusak, tapi jangan dipakai.
      return null;
    }

    // v1 adalah versi pertama, belum ada langkah migrasi.
    return data;
  }

  /* ---------------------------------------------------------------- */
  /* PERSISTENCE                                                       */
  /* ---------------------------------------------------------------- */

  /** true bila localStorage bisa dipakai (private mode sering gagal). */
  function isAvailable() {
    try {
      var probe = "__focusflow_probe__";
      global.localStorage.setItem(probe, "1");
      global.localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readRaw() {
    try {
      var text = global.localStorage.getItem(STORAGE_KEY);

      if (!text) {
        return null;
      }

      return JSON.parse(text);
    } catch (error) {
      console.warn("[FocusFlow] Gagal membaca localStorage, pakai data default.", error);
      return null;
    }
  }

  function writeRaw(next) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch (error) {
      console.warn("[FocusFlow] Gagal menyimpan ke localStorage.", error);
      return false;
    }
  }

  /* ---------------------------------------------------------------- */
  /* SUBSCRIBE                                                         */
  /* ---------------------------------------------------------------- */

  function notify() {
    // Salin dulu: listener boleh berhenti berlangganan saat sedang dijalankan.
    listeners.slice().forEach(function (listener) {
      try {
        listener(state);
      } catch (error) {
        console.error("[FocusFlow] Listener error.", error);
      }
    });
  }

  /** Kembalikan fungsi untuk berhenti berlangganan. */
  function subscribe(listener) {
    if (typeof listener !== "function") {
      return function () {};
    }

    listeners.push(listener);

    return function unsubscribe() {
      var index = listeners.indexOf(listener);

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /* ---------------------------------------------------------------- */
  /* API                                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Baca dari localStorage atau seed saat pertama kali.
   * Selalu mengembalikan objek state yang valid.
   */
  function init() {
    var stored = migrate(readRaw());

    if (stored) {
      state = normalize(stored);
    } else {
      state = createSeed();
      writeRaw(state);
    }

    return state;
  }

  function getState() {
    if (!state) {
      init();
    }

    return state;
  }

  /**
   * Terapkan perubahan, simpan, lalu beritahu semua subscriber.
   * mutator menerima objek state dan memodifikasinya langsung.
   *
   *   Store.update(function (s) { s.tasks.push(task); });
   *
   * Kembalikan false bila mutator melempar error (data tidak tersimpan).
   */
  function update(mutator) {
    if (!state) {
      init();
    }

    if (typeof mutator !== "function") {
      return false;
    }

    try {
      mutator(state);
    } catch (error) {
      console.error("[FocusFlow] Update gagal, perubahan tidak disimpan.", error);
      return false;
    }

    state.version = SCHEMA_VERSION;
    writeRaw(state);
    notify();

    return true;
  }

  /** Ganti seluruh state (dipakai saat reset). */
  function replace(next) {
    state = normalize(next);
    state.version = SCHEMA_VERSION;
    writeRaw(state);
    notify();

    return state;
  }

  /** Hapus semua data dan isi ulang dengan data contoh. */
  function resetAll() {
    return replace(createSeed());
  }

  /** Kembalikan pengaturan ke default, biarkan tugas & riwayat. */
  function resetSettings() {
    return update(function (s) {
      s.settings.focusMin = DEFAULTS.settings.focusMin;
      s.settings.breakMin = DEFAULTS.settings.breakMin;
      s.settings.sound = DEFAULTS.settings.sound;
    });
  }

  /** Buang localStorage dan state tanpa menyisakan jejak. */
  function clear() {
    try {
      global.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("[FocusFlow] Gagal menghapus localStorage.", error);
    }

    state = createDefaults();
    notify();

    return state;
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.Store = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEFAULTS: DEFAULTS,

    init: init,
    getState: getState,
    update: update,
    replace: replace,
    subscribe: subscribe,

    resetAll: resetAll,
    resetSettings: resetSettings,
    clear: clear,
    isAvailable: isAvailable,

    // Diekspor untuk pengujian.
    _normalize: normalize,
    _normalizeTimer: normalizeTimer,
    _migrate: migrate,
    _createSeed: createSeed,
    _createDefaults: createDefaults
  };
})(window);
