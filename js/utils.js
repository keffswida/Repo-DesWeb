/* Utils — helper murni tanpa state. Aman dipanggil kapan saja. */

(function (global) {
  "use strict";

  var LOCALE = "id-ID";

  /* ---------------------------------------------------------------- */
  /* ID                                                                */
  /* ---------------------------------------------------------------- */

  /**
   * Buat ID unik. crypto.randomUUID dipakai bila tersedia,
   * fallback ke timestamp + acak.
   */
  function uid(prefix) {
    var body;

    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      body = global.crypto.randomUUID();
    } else {
      body = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    }

    return prefix ? prefix + "_" + body : body;
  }

  /* ---------------------------------------------------------------- */
  /* ANGKA                                                            */
  /* ---------------------------------------------------------------- */

  function clamp(value, min, max) {
    var num = Number(value);

    if (Number.isNaN(num)) {
      num = min;
    }

    return Math.min(Math.max(num, min), max);
  }

  /* ---------------------------------------------------------------- */
  /* TEKS                                                             */
  /* ---------------------------------------------------------------- */

  var HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  /**
   * Netralkan karakter HTML pada teks yang dipercaya.
   *
   * Aplikasi ini tidak memakai innerHTML sama sekali — judul diisi lewat
   * textContent (lihat U.setText), jadi aman tanpa escaping. Fungsi ini
   * disediakan sebagai jaring pengaman bila kelak ada kebutuhan merender
   * teks pengguna ke innerHTML.
   */
  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return HTML_ESCAPES[ch];
    });
  }

  function truncate(value, max) {
    var text = String(value == null ? "" : value).trim();

    if (text.length <= max) {
      return text;
    }

    return text.slice(0, max - 1).trimEnd() + "…";
  }

  /* ---------------------------------------------------------------- */
  /* WAKTU                                                            */
  /* ---------------------------------------------------------------- */

  /** Menit → "25m" atau "1j 30m". Nol menit → "0m". */
  function formatDuration(minutes) {
    var total = Math.max(0, Math.round(Number(minutes) || 0));
    var hours = Math.floor(total / 60);
    var mins = total % 60;

    if (hours === 0) {
      return mins + "m";
    }

    if (mins === 0) {
      return hours + "j";
    }

    return hours + "j " + mins + "m";
  }

  /**
   * Menit → "25:00". Di bawah 60 menit tampil MM:SS,
   * 60 menit ke atas tampil H:MM:SS.
   */
  function formatClock(minutes) {
    return formatClockFromMs(Number(minutes) * 60000);
  }

  /**
   * Milidetik → "25:00". Angka dibulatkan ke atas supaya
   * timer tidak pernah menampilkan 00:00 sebelum benar-benar habis.
   */
  function formatClockFromMs(ms) {
    var totalSeconds = Math.ceil(Math.max(0, Number(ms) || 0) / 1000);
    var hours = Math.floor(totalSeconds / 3600);
    var mins = Math.floor((totalSeconds % 3600) / 60);
    var secs = totalSeconds % 60;

    if (hours > 0) {
      return hours + ":" + pad2(mins) + ":" + pad2(secs);
    }

    return pad2(mins) + ":" + pad2(secs);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  /* ---------------------------------------------------------------- */
  /* TANGGAL                                                          */
  /* ---------------------------------------------------------------- */

  function toDate(value) {
    if (value instanceof Date) {
      return value;
    }

    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  /** "25 Okt 2026" */
  function formatDate(value) {
    return new Intl.DateTimeFormat(LOCALE, {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(toDate(value));
  }

  /** "25 Okt, 10:30" */
  function formatDateTime(value) {
    var date = toDate(value);

    return (
      new Intl.DateTimeFormat(LOCALE, {
        day: "numeric",
        month: "short"
      }).format(date) +
      ", " +
      new Intl.DateTimeFormat(LOCALE, {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date)
    );
  }

  /** "10:30" */
  function formatTime(value) {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit"
    }).format(toDate(value));
  }

  /** "Hari ini, 10:30" | "Kemarin, 21:15" | "20 Okt, 09:00" */
  function formatSessionWhen(value) {
    var date = toDate(value);
    var today = startOfDay(new Date());
    var day = startOfDay(date);
    var diffDays = Math.round((today - day) / 86400000);

    if (diffDays === 0) {
      return "Hari ini, " + formatTime(date);
    }

    if (diffDays === 1) {
      return "Kemarin, " + formatTime(date);
    }

    if (diffDays < 7) {
      return (
        new Intl.DateTimeFormat(LOCALE, { weekday: "long" }).format(date) +
        ", " +
        formatTime(date)
      );
    }

    return formatDateTime(date);
  }

  /** "Selamat pagi" | "Selamat siang" | "Selamat sore" | "Selamat malam" */
  function greeting(date) {
    var hour = toDate(date).getHours();

    if (hour >= 5 && hour < 11) {
      return "Selamat pagi";
    }

    if (hour >= 11 && hour < 15) {
      return "Selamat siang";
    }

    if (hour >= 15 && hour < 18) {
      return "Selamat sore";
    }

    return "Selamat malam";
  }

  /** Awal hari lokal (bukan UTC). Penting untuk filter "hari ini". */
  function startOfDay(date) {
    var d = toDate(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function isSameDay(a, b) {
    return startOfDay(a).getTime() === startOfDay(b).getTime();
  }

  function isToday(value) {
    return isSameDay(value, new Date());
  }

  /** ISO string untuk datetime atribut <time>. */
  function toISOStringSafe(value) {
    var date = toDate(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  /* ---------------------------------------------------------------- */
  /* DOM                                                              */
  /* ---------------------------------------------------------------- */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /** Isi elemen dengan teks. Mengembalikan elemennya untuk chaining. */
  function setText(node, text) {
    if (node) {
      node.textContent = text == null ? "" : String(text);
    }

    return node;
  }

  function toggleClass(node, className, force) {
    if (node) {
      node.classList.toggle(className, force);
    }

    return node;
  }

  /**
   * Clone <template>, jalankan bindFn, kembalikan elemen pertama.
   * bindFn menerima elemen clone.
   */
  function fromTemplate(templateId, bindFn) {
    var template = document.getElementById(templateId);

    if (!template) {
      return null;
    }

    var fragment = template.content.cloneNode(true);

    if (typeof bindFn === "function") {
      bindFn(fragment);
    }

    return fragment.firstElementChild;
  }

  /* ---------------------------------------------------------------- */
  /* FEEDBACK                                                         */
  /* ---------------------------------------------------------------- */

  /** Tampilkan notifikasi singkat di #toast-region. */
  function toast(message, options) {
    var region = document.getElementById("toast-region");

    if (!region || !message) {
      return;
    }

    var opts = options || {};
    var node = document.createElement("div");

    node.className = "toast";
    node.textContent = message;

    if (opts.duration !== 0) {
      global.setTimeout(function () {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }, opts.duration || 2600);
    }

    region.appendChild(node);

    return node;
  }

  /**
   * Tanya user lewat #confirm-dialog. Mengembalikan Promise<boolean>.
   * Tombol di dalam dialog sudah punya value "confirm" dan "cancel",
   * Escape selalu dihitung sebagai batal.
   */
  function confirmDialog(options) {
    var dialog = document.getElementById("confirm-dialog");

    if (!dialog) {
      return global.Promise.resolve(false);
    }

    var opts = options || {};
    var titleEl = document.getElementById("confirm-title");
    var messageEl = document.getElementById("confirm-message");
    var okBtn = document.getElementById("confirm-ok");

    setText(titleEl, opts.title || "Konfirmasi");
    setText(messageEl, opts.message || "");
    setText(okBtn, opts.confirmLabel || "Hapus");

    // returnValue sengaja dikosongkan: kalau tidak, sisa "confirm"
    // dari pertanyaan sebelumnya ikut terbaca.
    dialog.returnValue = "";

    return new global.Promise(function (resolve) {
      function handleClose() {
        dialog.removeEventListener("close", handleClose);
        resolve(dialog.returnValue === "confirm");
      }

      dialog.addEventListener("close", handleClose);

      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.removeEventListener("close", handleClose);
        resolve(false);
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.Utils = {
    uid: uid,
    clamp: clamp,
    escapeHTML: escapeHTML,
    truncate: truncate,

    formatDuration: formatDuration,
    formatClock: formatClock,
    formatClockFromMs: formatClockFromMs,

    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatTime: formatTime,
    formatSessionWhen: formatSessionWhen,
    greeting: greeting,
    startOfDay: startOfDay,
    isSameDay: isSameDay,
    isToday: isToday,
    toISOStringSafe: toISOStringSafe,

    $: $,
    $$: $$,
    setText: setText,
    toggleClass: toggleClass,
    fromTemplate: fromTemplate,

    toast: toast,
    confirmDialog: confirmDialog
  };
})(window);
