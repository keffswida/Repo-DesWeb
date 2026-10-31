/* Tasks — CRUD tugas, filter, tugas aktif, dialog tambah/edit. */

(function (global) {
  "use strict";

  var U = global.Utils;
  var $ = U.$;
  var $$ = U.$$;

  var FILTERS = ["all", "active", "done"];
  var TODAY_LIMIT = 5;

  var currentFilter = "all";

  /* ---------------------------------------------------------------- */
  /* BACA                                                             */
  /* ---------------------------------------------------------------- */

  function getTasks() {
    return global.Store.getState().tasks;
  }

  function findTask(id) {
    if (!id) {
      return null;
    }

    return (
      getTasks().filter(function (task) {
        return task.id === id;
      })[0] || null
    );
  }

  /** Tugas yang sedang dipilih untuk dikerjakan. */
  function getActive() {
    return findTask(global.Store.getState().activeTaskId);
  }

  function getFiltered() {
    var tasks = getTasks();

    if (currentFilter === "active") {
      return tasks.filter(function (task) {
        return !task.done;
      });
    }

    if (currentFilter === "done") {
      return tasks.filter(function (task) {
        return task.done;
      });
    }

    return tasks;
  }

  /** Tugas belum selesai, terbaru dulu. */
  function getUnfinished() {
    return getTasks()
      .filter(function (task) {
        return !task.done;
      })
      .sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  /* ---------------------------------------------------------------- */
  /* TULIS                                                            */
  /* ---------------------------------------------------------------- */

  function add(data) {
    var task = {
      id: U.uid("t"),
      // Trim di sini, bukan hanya di form: pemanggil lain
      // (impor, pintasan) tidak boleh mengandalkan caller.
      title: String(data.title == null ? "" : data.title).trim(),
      estimateMin: data.estimateMin,
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null
    };

    if (!task.title) {
      U.toast("Judul tugas tidak boleh kosong");
      return null;
    }

    var ok = global.Store.update(function (s) {
      s.tasks.push(task);
    });

    if (ok) {
      U.toast("Tugas ditambahkan");
    }

    return ok ? task : null;
  }

  function edit(id, data) {
    var title = String(data.title == null ? "" : data.title).trim();

    if (!title) {
      U.toast("Judul tugas tidak boleh kosong");
      return false;
    }

    var found = false;

    global.Store.update(function (s) {
      s.tasks.forEach(function (task) {
        if (task.id !== id) {
          return;
        }

        task.title = title;
        task.estimateMin = data.estimateMin;
        found = true;
      });
    });

    if (found) {
      U.toast("Tugas diperbarui");
    }

    return found;
  }

  function remove(id) {
    var removed = false;

    global.Store.update(function (s) {
      var before = s.tasks.length;

      s.tasks = s.tasks.filter(function (task) {
        return task.id !== id;
      });

      removed = s.tasks.length !== before;

      // Tugas aktif ikut dibersihkan agar timer tidak menunjuk
      // tugas yang sudah tidak ada.
      if (s.activeTaskId === id) {
        s.activeTaskId = null;
      }
    });

    if (removed) {
      U.toast("Tugas dihapus");
    }

    return removed;
  }

  /**
   * Tandai selesai/belum selesai. Menyelesaikan tugas juga
   * melepas status aktif: tugas yang sudah selesai tidak perlu
   * lagi jadi target fokus berikutnya.
   */
  function toggle(id, done) {
    return global.Store.update(function (s) {
      s.tasks.forEach(function (task) {
        if (task.id !== id) {
          return;
        }

        task.done = done;
        task.completedAt = done ? new Date().toISOString() : null;
      });

      if (done && s.activeTaskId === id) {
        s.activeTaskId = null;
      }
    });
  }

  function setActive(id) {
    return global.Store.update(function (s) {
      s.activeTaskId = id || null;
    });
  }

  /* ---------------------------------------------------------------- */
  /* DIALOG                                                            */
  /* ---------------------------------------------------------------- */

  function openDialog(task) {
    var dialog = $("#task-dialog");

    if (!dialog) {
      return;
    }

    var isEdit = Boolean(task);

    U.setText($("#task-dialog-title"), isEdit ? "Edit tugas" : "Tambah tugas");
    U.setText($("#task-submit"), isEdit ? "Simpan perubahan" : "Simpan");

    $("#task-id").value = isEdit ? task.id : "";
    $("#task-title").value = isEdit ? task.title : "";
    $("#task-estimate").value = isEdit ? task.estimateMin : 30;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    }
  }

  function closeDialog() {
    var dialog = $("#task-dialog");

    if (dialog && dialog.open) {
      dialog.close();
    }
  }

  function readForm() {
    var title = $("#task-title").value.trim();
    var estimate = parseInt($("#task-estimate").value, 10);

    if (!title) {
      U.toast("Judul tugas tidak boleh kosong");
      $("#task-title").focus();
      return null;
    }

    if (Number.isNaN(estimate)) {
      estimate = 30;
    }

    return {
      title: title,
      // Batas input di HTML: 5..480. Di sini dipotong agar aman
      // walau nilai dikirim dari luar form.
      estimateMin: U.clamp(estimate, 5, 480)
    };
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                            */
  /* ---------------------------------------------------------------- */

  function buildTaskItem(task) {
    return U.fromTemplate("task-item-template", function (frag) {
      var item = frag.querySelector(".task-item");
      var toggleEl = frag.querySelector(".task-toggle");
      var titleEl = frag.querySelector(".task-title");

      item.setAttribute("data-task-id", task.id);

      toggleEl.checked = task.done;
      toggleEl.setAttribute(
        "aria-label",
        (task.done ? "Tandai belum selesai: " : "Tandai selesai: ") + task.title
      );

      U.setText(titleEl, task.title);

      U.setText(frag.querySelector(".task-estimate"), U.formatDuration(task.estimateMin));
      U.setText(frag.querySelector(".task-date"), U.formatDate(task.createdAt));

      frag.querySelector(".task-edit").setAttribute("aria-label", "Edit tugas: " + task.title);
      frag.querySelector(".task-delete").setAttribute("aria-label", "Hapus tugas: " + task.title);
    });
  }

  function renderList() {
    var list = $("#task-list");
    var empty = $("#tasks-empty");

    if (!list) {
      return;
    }

    var filtered = getFiltered();
    var total = getTasks().length;

    list.textContent = "";
    filtered.forEach(function (task) {
      list.appendChild(buildTaskItem(task));
    });

    // Daftar kosong bisa berarti belum ada tugas sama sekali,
    // atau filter menyaring semuanya. Pesannya harus berbeda.
    var noTasksAtAll = total === 0;
    var message = noTasksAtAll
      ? "Belum ada tugas. Mulai dari satu pekerjaan kecil."
      : "Tidak ada tugas pada filter ini.";

    U.setText(empty && empty.querySelector("p"), message);

    var addBtn = empty && empty.querySelector('[data-action="new-task"]');
    U.toggleClass(addBtn, "sr-only", !noTasksAtAll);

    list.hidden = filtered.length === 0;
    if (empty) {
      empty.hidden = filtered.length !== 0;
    }
  }

  /**
   * Hanya mengurus label jumlah tugas di halaman Tasks.
   * Kartu statistik dashboard (termasuk "tugas selesai") dihitung
   * dashboard.js — satu elemen, satu pemilik.
   */
  function renderCount() {
    var total = getTasks().length;

    U.setText($("#task-count-label"), total + " tugas");

    var emptyBtn = $("#tasks-empty") && $("#tasks-empty").querySelector('[data-action="new-task"]');
    U.setText(emptyBtn, "Tambah tugas pertama");
  }

  function renderToday() {
    var list = $("#today-task-list");
    var empty = $("#today-empty");

    if (!list) {
      return;
    }

    var tasks = getUnfinished().slice(0, TODAY_LIMIT);

    list.textContent = "";
    tasks.forEach(function (task) {
      list.appendChild(buildTaskItem(task));
    });

    list.hidden = tasks.length === 0;
    if (empty) {
      empty.hidden = tasks.length !== 0;
    }
  }

  function renderFocusSelect() {
    var select = $("#focus-task-select");
    var meta = $("#focus-task-meta");

    if (!select) {
      return;
    }

    var tasks = getUnfinished();
    var activeId = global.Store.getState().activeTaskId;
    var active = getActive();

    select.textContent = "";

    if (tasks.length === 0) {
      var option = document.createElement("option");
      option.value = "";
      option.textContent = "Belum ada tugas";
      select.appendChild(option);
      select.disabled = true;

      U.setText(meta, "Tambahkan tugas dulu di halaman Tasks.");
      return;
    }

    select.disabled = false;

    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Pilih tugas…";
    select.appendChild(placeholder);

    tasks.forEach(function (task) {
      var opt = document.createElement("option");
      opt.value = task.id;
      opt.textContent = task.title;
      select.appendChild(opt);
    });

    // Tugas aktif yang baru saja selesai tidak lagi ada di daftar,
    // jadi select kembali ke placeholder.
    select.value = tasks.some(function (t) {
      return t.id === activeId;
    })
      ? activeId
      : "";

    if (active) {
      U.setText(
        meta,
        U.formatDuration(active.estimateMin) + " estimasi · dibuat " + U.formatDate(active.createdAt)
      );
    } else {
      U.setText(meta, "Pilih satu tugas sebelum memulai timer.");
    }
  }

  function renderFilters() {
    $$(".filter-btn").forEach(function (btn) {
      var active = btn.getAttribute("data-filter") === currentFilter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  /** Render semua bagian yang bergantung pada data tugas. */
  function render() {
    renderList();
    renderCount();
    renderToday();
    renderFocusSelect();
    renderFilters();
  }

  /* ---------------------------------------------------------------- */
  /* EVENT                                                             */
  /* ---------------------------------------------------------------- */

  function taskIdFromEvent(event) {
    var item = event.target.closest("[data-task-id]");

    return item ? item.getAttribute("data-task-id") : null;
  }

  function onListClick(event) {
    var id = taskIdFromEvent(event);

    if (!id) {
      return;
    }

    if (event.target.closest(".task-edit")) {
      openDialog(findTask(id));
      return;
    }

    if (event.target.closest(".task-delete")) {
      var task = findTask(id);

      if (!task) {
        return;
      }

      U.confirmDialog({
        title: "Hapus tugas",
        message: 'Tugas "' + task.title + '" akan dihapus permanen. Riwayat sesinya tetap tersimpan.',
        confirmLabel: "Hapus"
      }).then(function (ok) {
        if (ok) {
          remove(id);
        }
      });
    }
  }

  function onListChange(event) {
    if (!event.target.classList.contains("task-toggle")) {
      return;
    }

    var id = taskIdFromEvent(event);

    if (id) {
      toggle(id, event.target.checked);
    }
  }

  function onFormSubmit(event) {
    event.preventDefault();

    var data = readForm();

    if (!data) {
      return;
    }

    var editingId = $("#task-id").value;

    if (editingId) {
      edit(editingId, data);
    } else {
      add(data);
    }

    closeDialog();
  }

  function onSelectChange(event) {
    if (event.target.id === "focus-task-select") {
      setActive(event.target.value || null);
    }
  }

  function onFilterClick(event) {
    var btn = event.target.closest(".filter-btn");

    if (!btn) {
      return;
    }

    var filter = btn.getAttribute("data-filter");

    if (FILTERS.indexOf(filter) === -1) {
      return;
    }

    currentFilter = filter;
    renderFilters();
    renderList();
  }

  function init() {
    // Delegasi di document: tombol "+ Tambah tugas" ada di
    // dashboard dan di tasks, dan bisa bertambah nanti.
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest('[data-action="new-task"]');

      if (trigger) {
        openDialog(null);
      }
    });

    ["#task-list", "#today-task-list"].forEach(function (selector) {
      var list = $(selector);

      if (list) {
        list.addEventListener("click", onListClick);
        list.addEventListener("change", onListChange);
      }
    });

    var form = $("#task-form");
    if (form) {
      form.addEventListener("submit", onFormSubmit);
    }

    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-close-dialog]")) {
        closeDialog();
      }
    });

    document.addEventListener("change", onSelectChange);
    document.addEventListener("click", onFilterClick);
  }

  /* ---------------------------------------------------------------- */
  /* EKSPOR                                                           */
  /* ---------------------------------------------------------------- */

  global.Tasks = {
    init: init,
    render: render,
    add: add,
    edit: edit,
    remove: remove,
    toggle: toggle,
    setActive: setActive,
    getActive: getActive,
    findTask: findTask,
    getUnfinished: getUnfinished,
    openDialog: openDialog,
    closeDialog: closeDialog
  };
})(window);
