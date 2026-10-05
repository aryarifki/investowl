# Changelog & Laporan Dokumentasi Perubahan 📝

Seluruh perubahan penting pada proyek **Re-Tracker (The Investowl)** didokumentasikan di berkas ini. Format mengacu pada prinsip [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mengikuti konvensi [Semantic Versioning](https://semver.org/).

---

## [1.4.0] - 2026-10-05

### ⚡ System Logs & Interactive Job Control Center, Concurrency Guard & History Picker

Pembaruan besar pada fitur observabilitas sistem dan manajemen eksekusi job background, mengubah halaman log pasif menjadi Interactive Job Control Center yang memungkinkan pemicuan manual langsung dari browser, pemantauan status proses real-time, proteksi anti-tabrakan proses (*concurrency lock*), penjelajahan riwayat file log historis, dan penyelarasan urutan eksekusi pipeline harian.

#### Ditambahkan (Added)
- **Interactive Job Control Center (`frontend/app/logs/page.tsx`)**:
  - Tombol aksi **"Jalankan Sekarang"** di setiap tab job (Backfill, Auditor, ETL Flow, Scanner, Full Pipeline).
  - Modal konfigurasi parameter fleksibel (pemilihan Universe: `watchlist`, `idx80`, `all`; pemilihan Lookback Windows).
  - Tombol penghentian aman **"Hentikan"** untuk membatalkan proses yang sedang berjalan (`SIGTERM`/`SIGKILL`) tanpa perlu SSH ke server.
  - Indikator status badge dinamis: `IDLE / SIAP`, `RUNNING (PID, Durasi)` beranimasi pulse, `SUCCESS`, dan `FAILED`.
  - Dropdown **Riwayat Log (History Picker)** untuk beralih antara log terkini (*Live*) dan file log tanggal-tanggal sebelumnya.
  - Fitur terminal tambahan: *Auto-scroll lock toggle*, *Copy Log* satu klik, dan *Adaptive Polling* (cepat saat ada proses aktif, melambat saat idle).
- **Backend Job Management Endpoints (`backend/routers/system.py`)**:
  - `GET /api/logs/jobs/status`: Memeriksa status real-time seluruh tugas otomatisasi beserta PID dan durasi aktif (dilengkapi deteksi proses eksternal via `/proc`).
  - `POST /api/logs/jobs/{job_name}/run`: Endpoint pemicu eksekusi subprocess di latar belakang dengan penulisan stdout/stderr ke file log.
  - `POST /api/logs/jobs/{job_name}/stop`: Menghentikan proses background secara aman.
  - `GET /api/logs/history`: Mengambil daftar file log historis berdasarkan nama job beserta ukuran file dan waktu modifikasi.
  - `GET /api/logs/view`: Membaca isi file log spesifik dengan sanitasi keamanan path traversal.
- **Proteksi Konkurensi & Collision Guard**:
  - Sistem mengunci eksekusi job jika job yang sama atau Full Pipeline sedang berjalan, mencegah lonjakan CPU 100% dan tabrakan transaksi database.
- **Penyelarasan Alur Kerja Visual**:
  - Penomoran tab antarmuka diselaraskan persis dengan urutan pipeline harian: `1. Backfill -> 2. Auditor -> 3. ETL Flow -> 4. Scanner -> Full Pipeline`.

#### Kualitas & Verifikasi
- **Backend Test Suite**: 34/34 skenario karakterisasi backend lulus 100% (`34 passed in 16.99s`).
- **Frontend Build**: Sukses terkompilasi melalui Next.js Turbopack (`npm run build`) dengan 14 rute teroptimasi.

---

## [1.3.0] - 2026-09-29

### 🎨 Material Design 3 Expressive Pastel, Guest Mode, Cloud Watchlist Sync, Peta Jejaring Interaktif & PWA

Pembaruan komprehensif pada antarmuka pengguna (UI/UX) dan sistem autentikasi, mengembalikan identitas visual pastel original yang bersih dan profesional tanpa AI-slop, memberikan akses publik terbuka (*Guest Mode*), sinkronisasi watchlist cloud via Google OAuth, navigasi jejaring graf konglomerasi horizontal tree dengan fitur pencarian autocomplete, serta kemampuan instalasi aplikasi instan sebagai Progressive Web App (PWA).

#### Ditambahkan (Added)
- **Guest Mode & Akses Publik Bebas Hambatan (`frontend/middleware.ts`)**:
  - Seluruh rute analitik (Beranda, Detail Emiten, Konglo, Foreign Flow, Whales, Backtest, Signal) kini dapat diakses secara instan oleh publik tanpa diwajibkan melakukan autentikasi login terlebih dahulu. Proteksi akses hanya diberlakukan untuk rute khusus administrator (`/admin`).
- **Autentikasi Google OAuth Fleksibel & Sinkronisasi Watchlist Cloud**:
  - Tombol login Google OAuth ditempatkan secara ergonomis di kanan atas header (`frontend/components/layout/LogoutButton.tsx`), memungkinkan pengguna masuk kapan saja untuk menyimpan data pribadi.
  - Setiap pengguna yang masuk melalui Google otomatis berstatus terverifikasi (`is_approved = True`).
  - Kolom `watchlist` (JSONB) ditambahkan pada model database PostgreSQL `users` (`backend/models.py`, `backend/schemas.py`).
  - Penambahan endpoint RESTful `GET /api/users/{email}/watchlist` dan `PUT /api/users/{email}/watchlist` (`backend/routers/auth.py`) untuk pertukaran data daftar pantau saham secara aman.
  - Beranda (`frontend/app/page.tsx`) secara otomatis mensinkronkan daftar pantau saham pengguna dengan cloud database saat pengguna login.
- **Tombol Bookmark Bintang di Header Emiten (`frontend/app/[ticker]/page.tsx`)**:
  - Tombol bintang interaktif di samping kode saham (misal: `BBCA ★`) untuk menambahkan atau menghapus emiten dari daftar pantau secara instan.
  - Terkoneksi otomatis dengan state global watchlist, `localStorage`, dan sinkronisasi server bila pengguna dalam keadaan login.
- **Peta Jejaring Kepemilikan Interaktif & Autocomplete Search (`frontend/components/konglo/OwnershipNetworkGraph.tsx`)**:
  - Visualisasi jejaring kepemilikan saham dirancang ulang sepenuhnya menggunakan tata letak hierarki horizontal tree yang mudah dibaca (Konglomerasi $\rightarrow$ Entitas Induk/Holding $\rightarrow$ Emiten Publik BEI).
  - Kolom pencarian cerdas dengan dropdown autocomplete untuk mencari emiten, perusahaan holding, atau grup konglomerasi, lengkap dengan fokus visual dan auto-centering canvas.
  - Kontrol navigasi canvas terintegrasi (Zoom In, Zoom Out, Reset Pan/Zoom, Fit View) dan kartu inspeksi detail entitas.
- **Progressive Web App (PWA) Support**:
  - Rute manifest dinamis Next.js App Router (`frontend/app/manifest.ts`) pada `/manifest.webmanifest`.
  - Icon PWA beresolusi tinggi 192px dan 512px serta Apple Touch Icon (`frontend/public/icon-192.png`, `frontend/public/icon-512.png`, `frontend/public/apple-touch-icon.png`) berlatar pastel.
  - Konfigurasi meta tag viewport dan `appleWebApp` pada `frontend/app/layout.tsx` untuk pengalaman fullscreen layaknya native app.

#### Diubah & Ditingkatkan (Changed)
- **Restorasi Tema Warna Pastel Material Design 3 Expressive (Anti AI-Slop)**:
  - Mengembalikan palet warna pastel asli (*seed color* `#F9EDE1`) di `frontend/app/globals.css` untuk mode terang (*light*) dan mode gelap (*dark*).
  - Menghilangkan secara menyeluruh seluruh garis pelangi (*rainbow bars* / multicolored gradient borders) di semua halaman aplikasi (`signal`, `foreign`, `konglo`, `whales`, `backtest`, `login`, `pending`).
  - Standarisasi kontainer header di seluruh halaman dengan `rounded-3xl` dan border `var(--md-sys-color-outline-variant)/60`.
- **Penyederhanaan Header Beranda (`frontend/app/page.tsx`)**:
  - Menghapus keterangan teknis yang padat (*Universe Assets*, *Watchlist Active*, *Engine Regime*, *Matching Algorithm*, serta tombol *Parameter Mode*).
  - Mengganti status database menjadi Assist Chip MD3 yang ringkas dan informatif: `Data Terkini: 28 Sep 2026`.

#### Verifikasi Kualitas
- **Backend Test Suite**: 61 skenario pengujian unit & integrasi lulus 100% (`61 passed, 2 warnings in 80.73s`).
- **Frontend Build**: Sukses terkompilasi melalui Turbopack (`npm run build`) dengan 0 TypeScript error.

---

## [1.2.0] - 2026-09-25

### 🧹 Eliminasi Dead Code, Restrukturisasi Folder, Fitur Konglomerasi & Verifikasi Penuh

Pembaruan besar (*major polish & consolidation*) pada arsitektur Investowl untuk mencapai keterbacaan kode maksimal, performa secepat kilat, dan kompatibilitas 100% tanpa mengubah data PostgreSQL atau logika matematis mesin SMtracker.

#### Ditambahkan (Added)
- **Fitur Matriks Konglomerasi IDX (`frontend/app/konglo/page.tsx`)**:
  - Halaman analitik pelacakan rotasi modal dan aliran Smart Money untuk 8 grup konglomerasi ekonomi terbesar di Indonesia:
    1. **Grup Djarum** (BBCA, TOWR, BELI, RANC)
    2. **Grup Barito** (BREN, BRPT, TPIA, CUAN, PTRO)
    3. **Grup Astra** (ASII, UNTR, AUTO, ASGR, AALI)
    4. **Grup Salim** (INDF, ICBP, LSIP, SIMP, AMMN)
    5. **Grup Sinarmas** (INKP, TKIM, SMMA, BSDE, DMAS)
    6. **Grup Bakrie** (BUMI, BRMS, DEWA, ENRG, VKTR)
    7. **BUMN Perbankan** (BBRI, BMRI, BBNI, BBTN)
    8. **BUMN Sumber Daya Alam** (PGAS, ANTM, PTBA, TINS, ELSA)
  - Integrasi kartu mini analitik per emiten dengan akumulasi Smart Money dan net flow 20 hari.
- **Suite Regresi Karakterisasi API Golden (`backend/tests/test_golden_characterization.py`)**:
  - 34 skenario pengujian komprehensif untuk memvalidasi kelengkapan endpoint, bentuk skema JSON, tipe data, status HTTP, dan nullability kontrak API.
- **Konsolidasi Komponen Analitik Asing (`frontend/components/foreign/`)**:
  - Menyatukan modul `BrokerHeatmap.tsx`, `BrokerNetworkGraph.tsx`, `ForeignFlowDeepDiveTab.tsx`, `HMMChart.tsx`, dan `VARChart.tsx`.

#### Dihapus (Removed)
- **Eliminasi 8 Komponen & Modul Mati di Frontend**:
  - `frontend/components/BrokerDetails.tsx` (tidak direferensikan)
  - `frontend/components/Watchlist.tsx` (duplikat lama beranda)
  - `frontend/components/MainChart.tsx` (digantikan chart canvas/ECharts)
  - `frontend/lib/api.ts` (fetcher usang yang tidak digunakan)
  - `frontend/app/components/MetricCard.tsx` (dipusatkan di `components/ui/MetricCard.tsx`)
  - `frontend/app/components/fmt.ts` (dipusatkan di `lib/format.ts`)
  - `frontend/app/components/ui/Tabs.tsx` (komponen tab redundan)
  - `frontend/types/index.ts` (file type kosong tanpa referensi)
- **Pembersihan Dependensi Frontend**:
  - Menghapus pustaka `lightweight-charts` dari `package.json` yang tidak terpakai sehingga memangkas bundle dependencies.
- **Eliminasi File Mati & Direktori Kosong Backend**:
  - Menghapus `backend/app/idx_bridge.py` dan `backend/idx_api_wrapper.py`.
  - Menghapus direktori kosong: `backend/app/`, `backend/src/`, `backend/data/`, `frontend/app/components/`, `frontend/lib/`, `frontend/types/`.

#### Diubah & Direstrukturisasi (Changed)
- **Penyelarasan Router Backend**:
  - Menempatkan seluruh 7 router FastAPI secara rapi dan datar di `backend/routers/`:
    `stocks.py`, `broker.py`, `auth.py`, `signal.py`, `system.py`, `foreign_flow.py`, `bandarmology.py`.
- **Preservasi Modul Analitik Asing**:
  - Mempertahankan `foreign_analytics.py` secara aman di `backend/services/foreign_analytics.py` sesuai instruksi khusus pengguna.
- **Konfigurasi Port Backend**:
  - Menetapkan port default backend Investowl ke **`8001`** (`PORT=8001`) untuk mencegah tabrakan port dengan service lokal lain di port `8000`.

#### Dioptimalkan (Performance)
- **PostgreSQL 60-Day Date Push-Down**:
  - Menambahkan filter klausa `WHERE date >= :start_date` langsung pada level kueri SQL di `bandarmology.py`, memangkas latensi eksekusi kueri hingga **11x lebih cepat** dan menghemat I/O memori server.
- **Dynamic Code-Splitting Tab Analitik**:
  - Mengimplementasikan `next/dynamic` dengan skeleton placeholder untuk 5 tab analitik di `frontend/app/[ticker]/page.tsx`, mereduksi bobot JavaScript inisial dan mempercepat *First Contentful Paint*.
- **Eliminasi Delay Buatan Beranda**:
  - Menghilangkan `setTimeout(1200)` buatan di `page.tsx` menjadi 0 ms *instant render*.

#### Verifikasi Kualitas
- **Backend**: 38 passed, 1 skipped dalam 37.27 detik (100% green).
- **Frontend**: 0 ESLint errors, `npm run build` sukses mengompilasi 11 rute dalam 13.7 detik.

---

## [1.1.1] - 2026-09-23

### ⚡ Pemulihan Arsitektur Stabil & Responsif (Rollback Optimasi Eksperimental)
- **Pemulihan Kecepatan Penuh**: Mengembalikan seluruh codebase backend dan frontend ke kondisi runtime stabil semula yang terbukti berkinerja sangat cepat (*instant*).
- **Penghapusan Bottleneck Frontend**:
  - Menghapus `experimental.optimizePackageImports` dari `next.config.ts` yang sebelumnya menyebabkan AST parsing lag puluhan detik pada modul grafik (`echarts` & `recharts`).
  - Mengembalikan static bundle import pada seluruh tab analitik emiten di `frontend/app/[ticker]/page.tsx` sehingga perpindahan tab kembali instan (0 ms).
  - Mengembalikan transisi render dan SWR data fetching pada `frontend/app/page.tsx`.
- **Pemulihan Koneksi Database Backend**:
  - Mengembalikan connection pool independen SQLAlchemy berukuran besar di `storage.py` (`pool_size=20`) untuk mencegah *connection starvation* saat request paralel.
  - Menghapus mekanisme thread lock pada cache in-memory untuk concurrency maksimal.
- **Klarifikasi Arsitektur**:
  - Re-Tracker beroperasi murni sebagai **Presentation & Analytical Viewer Layer** untuk menyajikan data yang ditarik dan diolah oleh [SMtracker](https://github.com/aryarifki/SMtracker).

---

## [1.1.0] - 2026-09-23

### ⚡ Ringkasan Pembaruan (Performance & Architecture Overhaul)
Pembaruan komprehensif tanpa mengubah logika bisnis, rumus matematis, atau tampilan visual antarmuka pengguna:
- **Performa Ekstrem**: Pemuatan halaman utama instan (eliminasi 1.200 ms artificial delay), dynamic code-splitting pada tab analitik emiten, lazy proxying library visualisasi (<1 ms vs 988 ms), dan push-down SQL query filtering.
- **Pencegahan Memory Leak**: Mengganti dictionary global unbounded dengan thread-safe `BoundedTTLCache` (LRU + TTL) pada modul bandarmologi dan klien API broker.
- **Pembersihan Kode & Refactoring**: Menghapus dead code komponen dan asset SVG boilerplate, menyatukan fungsi pemformatan angka (DRY) di `frontend/lib/format.ts`.
- **Restrukturisasi Direktori**: Memindahkan komponen foreign flow ke `frontend/components/foreign/`, memindahkan service analitik asing ke `backend/services/`, dan merapikan router backend.
- **Sinkronisasi Fitur Upstream**: Integrasi router `backend/routers/system.py`, halaman web terminal log emulator `frontend/app/logs/page.tsx`, dan toggle filter layer pada `SignalDashboard.tsx`.
- **Suite Pengujian Regresi**: Penambahan pengujian otomatis endpoint, cache eviction, router validation, dan profil broker (`backend/tests/test_api_regression.py`).

---

### 1. Refactor & Code Cleanup (Commit `94485c4`)
#### Ditambahkan
- *Tidak ada (fokus eliminasi dead code)*

#### Dihapus
- **Komponen Frontend yang Tidak Digunakan**:
  - `frontend/components/BrokerDetails.tsx` (komponen lama tidak terpasang)
  - `frontend/components/MainChart.tsx` (chart lama yang digantikan Lightweight Charts)
  - `frontend/components/Watchlist.tsx` (duplikat lama dari beranda)
  - `frontend/components/ConditionalBottomNav.tsx` (navigasi usang)
  - `frontend/components/GlobalSearch.tsx` (pencarian modal lawas)
  - `frontend/app/components/ui/Tabs.tsx` (komponen tab duplikat)
- **Asset Boilerplate Statis**:
  - `frontend/public/file.svg`
  - `frontend/public/globe.svg`
  - `frontend/public/next.svg`
  - `frontend/public/vercel.svg`
  - `frontend/public/window.svg`
- **Artefak Backend Usang**:
  - `backend/app/idx_bridge.py` (jembatan impor yang tidak lagi dipakai)
  - Dependensi `plotly` dihapus dari `backend/requirements.txt` karena tidak digunakan pada runtime API produksi.

---

### 2. Restrukturisasi Struktur Direktori & Formatter DRY (Commit `a3d4c4b`)
#### Diubah / Direstrukturisasi
- **Sentralisasi Formatter (`frontend/lib/format.ts`)**:
  - Mengekstrak fungsi `fmtRp`, `fmtPct`, `signedColor`, `signalColor`, dan `getProfileTextColor` menjadi modul utilitas terpusat.
  - Menghapus duplikasi logika pemformatan angka yang sebelumnya tersebar di 6 file: `BrokerFlowTab.tsx`, `RawTablesTab.tsx`, `ScreenerTab.tsx`, `ValidationTab.tsx`, `[ticker]/page.tsx`, dan `frontend/app/components/fmt.ts`.
- **Relokasi Komponen Foreign Flow**:
  - Memindahkan seluruh komponen analitik asing dari `frontend/app/components/ff/` ke `frontend/components/foreign/` (`BrokerHeatmap.tsx`, `BrokerNetworkGraph.tsx`, `ForeignFlowDeepDiveTab.tsx`, `HMMChart.tsx`, `VARChart.tsx`).
  - Memindahkan `frontend/app/components/MetricCard.tsx` ke `frontend/components/ui/MetricCard.tsx`.
  - Menghapus folder `frontend/app/components/` agar `app/` murni hanya berisi file rute (Next.js App Router convention).
- **Penyelarasan Router Backend**:
  - Memindahkan `backend/app/routers/bandarmology.py` ke `backend/routers/bandarmology.py`.
  - Membuat stub re-export kompatibilitas mundur pada `backend/app/routers/bandarmology.py` agar tidak memutus impor modul legacy.
  - Memindahkan `backend/src/services/foreign_analytics.py` ke `backend/services/foreign_analytics.py` dan mengeliminasi manipulasi `sys.path.insert(0, ...)` di runtime.

---

### 3. Optimasi Performa Ekstrem (Commit `132109f`)
#### Dioptimalkan
- **Frontend Code-Splitting Tab Analitik (`next/dynamic`)**:
  - Mengonversi tab analitik berat pada `frontend/app/[ticker]/page.tsx` (`BrokerFlowTab`, `AccumulationTab`, `RawTablesTab`, `ForeignFlowDeepDiveTab`, `ValidationTab`) menjadi dynamic import dengan loading fallback skeleton.
  - Mempercepat *First Contentful Paint* (FCP) dan *Total Blocking Time* (TBT) halaman ticker secara signifikan.
- **Penghapusan Delay Buatan di Beranda**:
  - Menghapus `setTimeout(1200)` pada `frontend/app/page.tsx`, membuat rendering data beranda menjadi instan tanpa jeda 1,2 detik buatan.
- **SWR Request Deduplication**:
  - Menambahkan konfigurasi `dedupingInterval: 60000` pada hook data beranda untuk mencegah spamming network request ke backend.
- **Next.js & Turbopack Compiler Settings**:
  - Menambahkan `experimental.optimizePackageImports: ["@iconify/react"]` dan `compiler.removeConsole` (mode production) di `frontend/next.config.ts`.
- **Thread-Safe Bounded TTL Cache (`backend/core/cache.py`)**:
  - Membuat kelas cache `BoundedTTLCache` dengan algoritma penggusuran LRU (*Least Recently Used*) dan TTL (*Time-To-Live*).
  - Menggantikan 4 dictionary `dict()` tak terbatas di `backend/routers/bandarmology.py` dan `backend/idx_bandarmology/broker_api.py`, sepenuhnya meniadakan risiko kebocoran memori (OOM).
- **Lazy Module Proxying Library Plotting**:
  - Mengganti impor eager `matplotlib.pyplot` dan `plotly.express` di `backend/idx_bandarmology/analysis.py` dengan proxy `_LazyModule`.
  - Waktu inisialisasi modul terpangkas dari **988 ms menjadi < 1 ms**.
- **PostgreSQL Push-Down Query Filtering**:
  - Memfilter rentang tanggal (`start_date`) langsung pada klausa `WHERE` kueri SQL di endpoint `ticker_detail`, menghindari transfer ribuan baris data yang tidak relevan ke memori server.
- **Database Connection Pooling**:
  - Menyelaraskan koneksi database di `backend/idx_bandarmology/storage.py` dengan engine pool terpusat dari `backend/database.py`.

---

### 4. Integrasi Fitur Upstream (Rebase Commits `9cee4eb..e8ec3cd`)
#### Ditambahkan
- **System Router Backend (`backend/routers/system.py`)**:
  - Endpoint `/api/system/logs/{type}` untuk membaca file log runtime sistem secara real-time.
- **Terminal Log Emulator Frontend (`frontend/app/logs/page.tsx`)**:
  - Antarmuka visual web bertema emulator terminal macOS/Linux untuk memantau log aplikasi.
- **Multi-Layer Scanner Toggle Pills (`frontend/components/signal/SignalDashboard.tsx`)**:
  - Komponen tombol toggle untuk memfilter emiten berdasarkan lapisan: *Technical*, *Smart Money*, *Sector*, dan *Fundamental*.

---

### 5. Suite Pengujian Regresi Otomatis (Commit `471707b`)
#### Ditambahkan
- Berkas pengujian baru `backend/tests/test_api_regression.py` yang mencakup:
  1. `test_root_endpoint`: Memvalidasi status respons root `/`.
  2. `test_registered_routes`: Memvalidasi kelengkapan seluruh prefix router API (`/api/v1/stocks`, `/api/v1/broker`, `/api/v1/auth`, `/api/bandar`, `/api/foreign-flow`, `/api/signal`, `/api/system`).
  3. `test_broker_profile_classification`: Memverifikasi keakuratan klasifikasi broker ritel vs institusi.
  4. `test_bounded_ttl_cache_eviction`: Menguji mekanisme penggusuran LRU dan kedaluwarsa TTL cache secara deterministik.
  5. `test_universe_resolution`: Memvalidasi resolusi universe saham LQ45, IDX30, dan All Tickers.

---

## [1.0.0] - Versi Awal
- Rilis awal migrasi platform dari Streamlit ke arsitektur decoupled FastAPI + Next.js.
- Modul kalkulasi bandarmologi, integrasi API IDX & Stockbit, model HMM dan VAR IRF.
