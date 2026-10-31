/* Dashboard — statistik dan ringkasan. Semua angka dihitung dari
 * data nyata di Store, bukan angka contoh. */

(function (global) {
  "use strict";

  var U = global.Utils;
  var $ = U.$;

  var RECENT_LIMIT = 3;

  /* ---------------------------------------------------------------- */
  /* HITUNG                                                            */
  /* ---------------------------------------------------------------- */

  function getSessions() {
    return global.Store.getState().sessions;
  }

  function getTasks() {
    return global.Store.getState().tasks;
  }

  /** Total menit dari semua sesi. */
  function totalFocusMinutes() {
    return getSessions().reduce(function (sum, session) {
      return sum + session.durationMin;
    }, 0);
  }

  /** Total menit sesi yang selesai hari ini. */
  function todayFocusMinutes() {
    return getSessions().reduce(function (sum, session) {
      return sum + (U.isToday(session.completedAt) ? session.durationMin : 0);
    }, 0);
  }

  function taskCounts() {
    var tasks = getTasks();
    var done = tasks.filter(function (task) {
      return task.done;
    }).length;

    return { total: tasks.length, done: done };
  }

  /** Persentase tugas selesai, 0-100. Nol tugas dianggap 0. */
  function progressPercent() {
    var counts = taskCounts();

    if (counts.total === 0) {
      return 0;
    }

    return Math.round((counts.done / counts.total) * 100);
  }

  /** Sesi terbaru dulu. */
  function recentSessions() {
    return getSessions()
      .slice()
      .sort(function (a, b) {
        return new Date(b.completedAt) - new Date(a.completedAt);
      });
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                            */
  /* ---------------------------------------------------------------- */

  function renderGreeting() {
    U.setText($("#dashboard-greeting"), U.greeting(new Date()));
  }

  function renderStats() {
    var counts = taskCounts();

    U.setText($("#stat-focus-total"), U.formatDuration(totalFocusMinutes()));
    U.setText($("#stat-sessions"), getSessions().length);
    U.setText($("#stat-today-focus"), U.formatDuration(todayFocusMinutes()));

    U.setText($("#stat-tasks-done"), counts.done);
    U.setText($("#stat-tasks-hint"), "dari " + counts.total + " tugas");
  }

  function renderProgress() {
    var counts = taskCounts();
    var percent = progressPercent();
    var bar = $("#daily-progress-bar");
    var wrap = $("#daily-progress");

    U.setText($("#daily-progress-text"), counts.done + " dari " + counts.total + " tugas selesai");

    if (bar) {
      bar.style.width = percent + "%";
    }

    if (wrap) {
      wrap.setAttribute("aria-valuenow", String(percent));
      wrap.setAttribute(
        "aria-valuetext",
        counts.done + " dari " + counts.total + " tugas selesai"
      );
    }
  }

  function renderRecent() {
    var list = $("#recent-session-list");
    var empty = $("#recent-empty");

    if (!list) {
      return;
    }

    var sessions = recentSessions().slice(0, RECENT_LIMIT);

    list.textContent = "";

    sessions.forEach(function (session) {
      var item = U.fromTemplate("session-item-template", function (frag) {
        var li = frag.querySelector(".session-item");

        U.setText(frag.querySelector(".session-title"), session.taskTitle);
        U.setText(frag.querySelector(".session-duration"), U.formatDuration(session.durationMin));

        var timeEl = frag.querySelector(".session-time");
        U.setText(timeEl, U.formatSessionWhen(session.completedAt));
        timeEl.setAttribute("datetime", U.toISOStringSafe(session.completedAt));
      });

      if (item) {
        list.appendChild(item);
      }
    });

    list.hidden = sessions.length === 0;
    if (empty) {
      empty.hidden = sessions.length !== 0;
    }
  }

  function render() {
    renderGreeting();
    renderStats();
    renderProgress();
    renderRecent();
  }

  function init() {
    render();
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.Dashboard = {
    init: init,
    render: render,
    totalFocusMinutes: totalFocusMinutes,
    todayFocusMinutes: todayFocusMinutes,
    progressPercent: progressPercent,
    recentSessions: recentSessions
  };
})(window);
