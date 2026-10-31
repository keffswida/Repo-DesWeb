/* History — riwayat sesi fokus. */

(function (global) {
  "use strict";

  var U = global.Utils;
  var $ = U.$;

  /* ---------------------------------------------------------------- */
  /* BACA                                                             */
  /* ---------------------------------------------------------------- */

  /** Sesi terbaru dulu. */
  function getSorted() {
    return global.Store.getState().sessions
      .slice()
      .sort(function (a, b) {
        return new Date(b.completedAt) - new Date(a.completedAt);
      });
  }

  function totalMinutes() {
    return global.Store.getState().sessions.reduce(function (sum, session) {
      return sum + session.durationMin;
    }, 0);
  }

  /* ---------------------------------------------------------------- */
  /* TULIS                                                            */
  /* ---------------------------------------------------------------- */

  function clear() {
    return global.Store.update(function (s) {
      s.sessions = [];
    });
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                            */
  /* ---------------------------------------------------------------- */

  function buildItem(session) {
    return U.fromTemplate("session-item-template", function (frag) {
      U.setText(frag.querySelector(".session-title"), session.taskTitle);
      U.setText(frag.querySelector(".session-duration"), U.formatDuration(session.durationMin));

      var timeEl = frag.querySelector(".session-time");
      U.setText(timeEl, U.formatSessionWhen(session.completedAt));
      timeEl.setAttribute("datetime", U.toISOStringSafe(session.completedAt));
    });
  }

  function renderList() {
    var list = $("#history-list");
    var empty = $("#history-empty");

    if (!list) {
      return;
    }

    var sessions = getSorted();

    list.textContent = "";

    sessions.forEach(function (session) {
      var item = buildItem(session);

      if (item) {
        list.appendChild(item);
      }
    });

    list.hidden = sessions.length === 0;
    if (empty) {
      empty.hidden = sessions.length !== 0;
    }
  }

  function renderSummary() {
    var sessions = global.Store.getState().sessions;
    var parts = [];

    if (sessions.length === 0) {
      U.setText($("#history-summary"), "Belum ada sesi tercatat");
    } else {
      parts.push(sessions.length + " sesi");
      parts.push(U.formatDuration(totalMinutes()) + " total fokus");
      U.setText($("#history-summary"), parts.join(" · "));
    }

    var clearBtn = $("#history-clear");

    if (clearBtn) {
      clearBtn.disabled = sessions.length === 0;
    }
  }

  function render() {
    renderList();
    renderSummary();
  }

  /* ---------------------------------------------------------------- */
  /* EVENT                                                             */
  /* ---------------------------------------------------------------- */

  function onClearClick() {
    var count = global.Store.getState().sessions.length;

    if (count === 0) {
      return;
    }

    U.confirmDialog({
      title: "Hapus riwayat",
      message:
        count +
        " sesi fokus akan dihapus permanen. Statistik di dashboard ikut kembali nol. Tugas tidak terpengaruh.",
      confirmLabel: "Hapus riwayat"
    }).then(function (ok) {
      if (ok) {
        clear();
        U.toast("Riwayat dihapus");
      }
    });
  }

  function init() {
    var clearBtn = $("#history-clear");

    if (clearBtn) {
      clearBtn.addEventListener("click", onClearClick);
    }

    render();
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.History = {
    init: init,
    render: render,
    clear: clear,
    getSorted: getSorted,
    totalMinutes: totalMinutes
  };
})(window);
