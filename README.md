# FocusFlow — Make Time Count

Aplikasi web produktivitas pribadi: satu tugas, satu sesi fokus, tanpa distraksi.
Berjalan penuh di peramban, tanpa server, tanpa akun.

Semua data disimpan di `localStorage` browser. Tidak ada data yang dikirim ke mana pun.

## Menjalankan

Buka `index.html` langsung di peramban. Tidak perlu build, tidak perlu server.

```
double-click index.html → selesai
```

Struktur klasik `<script>` biasa (bukan ES module) disengaja, supaya halaman tetap
jalan dari `file://` — termasuk saat dikumpulkan sebagai berkas.

## Fitur

| Halaman | Isi |
| --- | --- |
| **Dashboard** | Sapaan, total fokus, jumlah sesi, fokus hari ini, progres tugas, 3 sesi terakhir |
| **Focus** | Timer besar dengan cincin kemajuan, pilih tugas, mode fokus/istirahat |
| **Tasks** | Tambah, ubah, tandai selesai, hapus, filter (semua / belum selesai / selesai) |
| **History** | Seluruh sesi fokus tercatat, bisa dihapus semua |
| **Settings** | Durasi fokus & istirahat, bunyi, kembalikan default, hapus semua data |

## Aturan timer

Beberapa keputusan di sini bukan kebetulan:

- **Sisa waktu dihitung dari `endAt`**, bukan dikurangi tiap detik. Timer tetap akurat
  walau tab di latar belakang ditunda peramban. Cukup buka kembali tab, angka benar.
- **Sesi direkam tepat satu kali.** Penanda `sessionRecorded` dikunci di dalam
  penyimpanan yang sama dengan pemasukan sesi, sehingga mustahil tercatat dua kali
  walau `complete()` dipanggil berulang.
- **Jeda tidak menghitung mundur.** Saat dijeda, sisa waktu dibekukan.
- **Reset tidak mencatat sesi.** Sesi hanya tercatat bila benar-benar selesai.
- **Sesi istirahat tidak masuk riwayat.** Riwayat khusus sesi fokus.
- **Fokus selesai tidak otomatis memulai istirahat.** Timer kembali diam; pengguna
  memilih sendiri kapan istirahat dimulai.
- **Judul tugas di-snapshot** ke dalam sesi saat timer mulai, sehingga riwayat tetap
  menampilkan nama yang benar walaupun tugas itu sudah dihapus.

## Durasi & batas

| Pengaturan | Rentang | Default |
| --- | --- | --- |
| Fokus | 1–120 menit | 25 |
| Istirahat | 1–60 menit | 5 |

Nilai di luar rentang dijaga **dua lapis**: validasi `min`/`max` pada HTML menolak
pengiriman form, dan clamp di `js/settings.js` memotong nilai bila dipanggil langsung.
Keduanya sengaja ada — lapis kedua menutupi kasus form dimanipulasi.

## Struktur berkas

```
index.html              seluruh markup: 5 tampilan, 2 dialog, 2 template
css/
  tokens.css            variabel desain: warna, jarak, tipografi, lapisan
  base.css              reset, tipografi, utilitas (sr-only, skip-link)
  layout.css            sidebar, topbar, grid responsif
  components.css        tombol, kartu, formulir, dialog, toast, baris tugas
  views.css             cincin timer, bilah progres, kartu statistik
js/
  utils.js              helper bersama: escape, format, toast, dialog konfirmasi
  store.js              localStorage, normalisasi, migrasi versi
  tasks.js              CRUD tugas, filter, tugas aktif
  timer.js              logika timer: endAt, jeda, lanjut, rekam sekali
  dashboard.js          statistik & sapaan
  history.js            riwayat sesi
  settings.js           pengaturan & pengelolaan data
  app.js                orkestrator, router hash, sidebar mobile
assets/favicon.svg
docs/                   dokumen konsep
```

Urutan `<script>` di `index.html` mengikuti dependensi dan tidak boleh diacak:
`utils → store → tasks/timer/dashboard/history/settings → app`.

## Penyimpanan

Satu kunci: `focusflow:v1`.

Struktur disimpan dalam keadaan ternormalisasi — setiap kali dibaca, `normalize()`
memastikan seluruh field ada dan bertipe benar, lalu hasilnya ditulis balik.
Data lama dimigrasikan; data rusak (JSON tidak valid) jatuh ke data contoh dan
ditulis ulang, sehingga aplikasi tidak pernah menampilkan layar kosong.

## Catatan aksesibilitas

- Skip link "Lewati ke konten utama" memindahkan fokus keyboard ke `<main>`.
- Navigasi memindahkan fokus ke tampilan baru, lalu kembali ke menu saat Escape.
- Bilah progres memakai `role="progressbar"` dengan `aria-valuenow` **dan**
  `aria-valuetext`, supaya pembaca layar menyebut "1 dari 3 tugas", bukan sekadar "33".
- Jam timer memakai `role="timer"` dengan `aria-live="off"` — tiap detik tidak
  diumumkan. Perubahan status diumumkan lewat elemen tersembunyi `#timer-status`
  yang `aria-live="polite"`.
- Judul tugas dan riwayat diisi lewat `textContent` (`U.setText`), bukan
  `innerHTML`. Tidak ada satu pun `innerHTML` di seluruh proyek, sehingga judul
  berisi tag HTML dirender sebagai teks biasa — bukan dieksekusi. Tidak
  bergantung pada escaping.

## Diketahui

- **Data hanya setempat.** Mengganti peramban atau perangkat berarti mulai dari nol.
  Tidak ada ekspor/impor.
- **Tidak ada mode offline.** Peramban harus sudah membuka berkasnya.
- **Bunyi** dibuat lewat Web Audio API, jadi tidak membutuhkan berkas audio tambahan.

## Pengujian

Uji logika dijalankan lewat Node dengan stub DOM. Uji integrasi dijalankan di
Chrome sungguhan melalui DevTools Protocol — mencakup 198 pemeriksaan: dialog
`showModal`, timer berjalan sungguhan, klik mouse nyata, hash routing, sidebar
mobile di lebar 390px, ketahanan terhadap `localStorage` rusak, dan keamanan XSS.

## Referensi

`docs/FocusFlow_Konsep_Final_UTS.pdf` — dokumen konsep asli.
