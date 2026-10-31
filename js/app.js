/* App — orkestrator: inisialisasi modul, router hash, sidebar mobile. */

(function (global) {
  "use strict";

  var U = global.Utils;
  var $ = U.$;
  var $$ = U.$$;

  var DEFAULT_ROUTE = "dashboard";

  /** Judul halaman + subjudul yang tampil di topbar. */
  var ROUTES = {
    dashboard: { title: "Dashboard", subtitle: "Ringkasan produktivitasmu" },
    focus: { title: "Focus", subtitle: "Satu tugas, satu sesi, tanpa distraksi" },
    tasks: { title: "Tasks", subtitle: "Kelola daftar tugasmu" },
    history: { title: "History", subtitle: "Riwayat sesi fokus" },
    settings: { title: "Settings", subtitle: "Preferensi dan pengelolaan data" }
  };

  var currentRoute = null;

  /* ---------------------------------------------------------------- */
  /* ROUTER                                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Ambil nama rute dari hash. Hash yang tidak diawali "#/" diabaikan —
   * itu milik browser, misalnya skip link "#main-content".
   */
  function routeFromHash() {
    var hash = global.location.hash;

    if (!hash || hash.indexOf("#/") !== 0) {
      return null;
    }

    var name = hash.slice(2).split("?")[0].replace(/\/+$/, "");

    return ROUTES[name] ? name : null;
  }

  function navigate(name) {
    if (!ROUTES[name]) {
      return;
    }

    currentRoute = name;

    // Tampilkan section yang sesuai, sembunyikan sisanya.
    $$(".view").forEach(function (view) {
      var isTarget = view.getAttribute("data-view") === name;
      view.hidden = !isTarget;
    });

    // Sinkronkan nav sidebar.
    $$(".nav-link").forEach(function (link) {
      var isCurrent = link.getAttribute("data-nav") === name;
      link.classList.toggle("is-active", isCurrent);

      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    U.setText($("#page-title"), ROUTES[name].title);
    U.setText($("#page-subtitle"), ROUTES[name].subtitle);
    document.title = ROUTES[name].title + " · FocusFlow";

    closeSidebar();

    renderAll();
  }

  function onHashChange() {
    var name = routeFromHash();

    // Hash di luar router (skip link, anchor internal): jangan
    // merusak tampilan. Biarkan browser menangani scroll-nya sendiri.
    if (!name) {
      return;
    }

    if (name !== currentRoute) {
      navigate(name);

      // Pindahkan fokus ke section agar pengguna layar baca langsung
      // ke konten baru, bukan tetap di menu.
      var view = $('.view[data-view="' + name + '"]');

      if (view) {
        view.focus();
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* SIDEBAR MOBILE                                                    */
  /* ---------------------------------------------------------------- */

  function sidebarIsOpen() {
    var sidebar = $("#sidebar");

    return Boolean(sidebar && sidebar.classList.contains("is-open"));
  }

  function openSidebar() {
    var sidebar = $("#sidebar");
    var backdrop = $("#sidebar-backdrop");
    var toggle = $("#menu-toggle");

    U.toggleClass(sidebar, "is-open", true);
    U.toggleClass(backdrop, "is-open", true);

    if (backdrop) {
      backdrop.hidden = false;
    }

    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Tutup Menu");
    }
  }

  function closeSidebar() {
    var sidebar = $("#sidebar");
    var backdrop = $("#sidebar-backdrop");
    var toggle = $("#menu-toggle");

    U.toggleClass(sidebar, "is-open", false);
    U.toggleClass(backdrop, "is-open", false);

    if (backdrop) {
      backdrop.hidden = true;
    }

    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Buka Menu");
    }
  }

  function toggleSidebar() {
    if (sidebarIsOpen()) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                           */
  /* ---------------------------------------------------------------- */

  /** Panggil render semua modul. Aman bila ada modul gagal dimuat. */
  function renderAll() {
    ["Tasks", "Timer", "Dashboard", "History", "Settings"].forEach(function (name) {
      var module = global[name];

      if (module && typeof module.render === "function") {
        try {
          module.render();
        } catch (error) {
          console.error("[FocusFlow] Gagal render " + name + ".", error);
        }
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* TOPBAR                                                           */
  /* ---------------------------------------------------------------- */

  function renderTodayLabel() {
    var label = $("#today-label");

    if (!label) {
      return;
    }

    var now = new Date();

    U.setText(
      label,
      new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(now)
    );

    label.setAttribute("datetime", U.toISOStringSafe(now));
  }

  /* ---------------------------------------------------------------- */
  /* INIT                                                             */
  /* ---------------------------------------------------------------- */

  function initModules() {
    ["Tasks", "Timer", "Dashboard", "History", "Settings"].forEach(function (name) {
      var module = global[name];

      if (module && typeof module.init === "function") {
        try {
          module.init();
        } catch (error) {
          console.error("[FocusFlow] Gagal inisialisasi " + name + ".", error);
        }
      }
    });
  }

  function bindSidebar() {
    var toggle = $("#menu-toggle");
    var backdrop = $("#sidebar-backdrop");

    if (toggle) {
      toggle.addEventListener("click", toggleSidebar);
    }

    if (backdrop) {
      backdrop.addEventListener("click", closeSidebar);
    }

    // Klik link menu di mobile harus ikut menutup sidebar.
    $$(".nav-link").forEach(function (link) {
      link.addEventListener("click", closeSidebar);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && sidebarIsOpen()) {
        closeSidebar();
        var toggleBtn = $("#menu-toggle");

        if (toggleBtn) {
          toggleBtn.focus();
        }
      }
    });
  }

  function init() {
    global.Store.init();

    renderTodayLabel();
    bindSidebar();
    initModules();

    // Semua perubahan data lewat Store.update, jadi satu langganan
    // sudah cukup untuk menjaga seluruh tampilan tetap sinkron.
    global.Store.subscribe(renderAll);

    var startRoute = routeFromHash() || DEFAULT_ROUTE;

    if (!global.location.hash) {
      global.history.replaceState(null, "", "#/" + DEFAULT_ROUTE);
    }

    navigate(startRoute);

    global.addEventListener("hashchange", onHashChange);
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.App = {
    init: init,
    navigate: navigate,
    routeFromHash: routeFromHash,
    renderAll: renderAll,
    openSidebar: openSidebar,
    closeSidebar: closeSidebar
  };

  // Mulai setelah seluruh script selesai dibaca (script di akhir body
  // tanpa defer, jadi DOM sudah siap di sini).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
