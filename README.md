# Repo DesWeb

Repository tugas Desain dan Pemrograman Web.

## Struktur

```
.
├── index.html        # Halaman utama CV
├── edu.html          # Halaman pendidikan
└── assets/
    ├── css/ini-css.css
    ├── js/ini-js.js
    ├── images/
    └── svgs/
```

## Cara Pull Branch `kelas/tugas-2`

### 1. Clone repository (belum punya repo lokal)

```bash
git clone https://github.com/keffswida/Repo-DesWeb.git
cd Repo-DesWeb
git checkout kelas/tugas-2
```

### 2. Sudah punya repo lokal, update branch saja

```bash
git fetch origin
git checkout kelas/tugas-2
git pull origin kelas/tugas-2
```

### 3. Jalankan secara lokal

Buka `index.html` langsung di browser, atau gunakan Live Server (VS Code).

## Cara Push Perubahan

```bash
git add .
git commit -m "feat: deskripsi perubahan"
git push origin kelas/tugas-2
```

## Branch Lain

| Branch              | Fungsi                     |
| ------------------- | -------------------------- |
| `kelas/tugas-1`     | Tugas 1 kelas              |
| `kelas/tugas-2`     | Tugas 2 kelas (ini)        |
| `praktikum/tugas-1` | Tugas 1 praktikum          |
| `praktikum/tugas-2` | Tugas 2 praktikum          |
