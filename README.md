# Re-Tracker (The Investowl) 🦉📈

[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016%20Turbopack-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%20%7C%203.11-3776AB?style=flat-square&logo=python)](https://python.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Cache-Redis-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-12%2F12%20Passed-brightgreen?style=flat-square&logo=pytest)](https://docs.pytest.org/)

**Re-Tracker (The Investowl)** adalah platform analitik kuantitatif pasar modal tingkat lanjut (*Institutional Grade*) yang dirancang khusus untuk menganalisis **Bandarmologi (Smart Money Flow)** dan **Foreign Flow** pada saham-saham Bursa Efek Indonesia (IDX).

Platform ini menggabungkan model matematika kuantitatif (Greedy Matching counterparty broker, Gaussian Hidden Markov Models untuk identifikasi regime akumulasi/distribusi pasar, Vector Autoregression Impulse Response Functions, dan Herfindahl-Hirschman Index konsentrasi broker) dengan antarmuka web modern berbasis **Next.js 16** dan sistem token desain **Material Design 3 (MD3) Expressive**.

---

> 📚 **Dokumentasi Terkait:**
> - 📘 **[PANDUAN_PENGGUNAAN.md](./PANDUAN_PENGGUNAAN.md)**: Panduan detail penggunaan fitur, pembacaan metrik, dan operasional.
> - 📝 **[CHANGELOG.md](./CHANGELOG.md)**: Riwayat lengkap perubahan versi, refactoring, dan perbaikan performa.

## 📑 Daftar Isi

1. [Fitur Utama](#-fitur-utama)
2. [Arsitektur Sistem](#-arsitektur-sistem)
3. [Panduan Instalasi & Menjalankan Aplikasi](#-panduan-instalasi--menjalankan-aplikasi)
4. [Panduan Penggunaan Aplikasi (User Manual)](#-panduan-penggunaan-aplikasi-user-manual)
5. [Dokumentasi Perubahan & Optimasi Arsitektur (Changelog)](#-dokumentasi-perubahan--optimasi-arsitektur-changelog)
6. [Struktur Direktori Codebase](#-struktur-direktori-codebase)
7. [Referensi API Endpoint](#-referensi-api-endpoint)
8. [Pengujian & Verifikasi Kualitas](#-pengujian--verifikasi-kualitas)

---

## 🌟 Fitur Utama

- **🦉 Smart Money & Bandarmologi Engine**:
  - Rekonstruksi aliran transaksi broker harian menggunakan algoritma *Greedy Matching* volume-price.
  - Klasifikasi profil partisipan pasar secara otomatis (Asing, Domestik Institusi, Pemerintah, dan Ritel).
  - Evaluasi konsentrasi akumulasi/distribusi Top-1, Top-3, dan Top-5 broker.
- **🌐 Foreign Flow Deep Dive Analytics**:
  - Pelacakan akumulasi dan distribusi bersih investor asing secara historis.
  - **HMM Regime Detection**: Gaussian Hidden Markov Model 3-state untuk mendeteksi rezim pasar (Akumulasi Kuat, Netral, Distribusi Berat).
  - **VAR Impulse Response Function (IRF)**: Analisis kausalitas dinamis antara net buy asing dan pergerakan return saham.
  - **Broker Network Graph & Heatmap**: Visualisasi jaringan transaksi antar-broker dan matriks korelasi counterparty.
- **⚡ AI Multi-Layer Signal Dashboard**:
  - Sistem penilaian kuantitatif multi-layer: *Technical*, *Smart Money*, *Sector*, dan *Fundamental*.
  - Penyaringan dinamis adaptif terhadap rezim pasar (*Dynamic BEAR Market Threshold*).
  - Filter toggle interaktif untuk menyaring emiten berdasarkan layer tertentu.
- **📊 Interactive Charts & Visualization**:
  - Grafik candlestick interaktif berbasis TradingView Lightweight Charts.
  - Visualisasi grafik HMM, VAR IRF, dan Heatmap menggunakan Apache ECharts.
- **🛡️ Autentikasi & Keamanan Multi-Tier**:
  - Login aman menggunakan Google OAuth melalui NextAuth.js.
  - *Admin Approval Gate*: Akun baru diarahkan ke status pending hingga disetujui administrator melalui Admin Panel.
  - Rate limiting berbasis IP/endpoint menggunakan Redis terpusat.
- **🖥️ Live System Log Terminal**:
  - Pemantau log real-time di antarmuka web (`/logs`) dengan tampilan emulator terminal Linux untuk memantau aktivitas ingestion background, cron data, dan error runtime.

---

## 🏛️ Arsitektur Sistem

```
┌────────────────────────────────────────────────────────┐
│                   Next.js 16 Web Client                │
│       React 19 · TypeScript · Tailwind CSS v4 · SWR     │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP JSON / SSE (GZip)
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI Backend                     │
│               Python 3.10+ · Uvicorn · Pydantic         │
├───────────────────────────┬────────────────────────────┤
│ Routers:                  │ Core Quantitative Modules: │
│ - /api/v1/stocks          │ - idx_bandarmology         │
│ - /api/v1/broker          │ - services/foreign_analyt. │
│ - /api/bandar             │ - core/cache (LRU + TTL)   │
│ - /api/foreign-flow       │ - pipeline ETL & Ingestion │
│ - /api/signal             │ - HMM / VAR / Greedy Match │
│ - /api/system             │                            │
└─────────────┬─────────────────────────────┬────────────┘
              │                             │
┌─────────────▼─────────────┐ ┌─────────────▼────────────┐
│    PostgreSQL Database    │ │       Redis Server       │
│  Tabel OHLCV, Broker Flow │ │ Rate Limiting, Temporary │
│  & Master Universe IDX    │ │ Cache & In-Memory Store  │
└───────────────────────────┘ └──────────────────────────┘
```

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### 1. Prasyarat Sistem
- **Node.js**: Versi `v18.18+` atau `v20+` / `v22+` (disertai `npm`)
- **Python**: Versi `3.10` atau `3.11`
- **PostgreSQL**: Versi 14+ aktif
- **Redis Server**: Versi 6+ aktif

---

### 2. Setup Backend (FastAPI)

1. Masuk ke direktori backend:
   ```bash
   cd backend
   ```
2. Buat dan aktifkan virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Di Linux/macOS
   # atau venv\Scripts\activate di Windows
   ```
3. Pasang seluruh dependensi:
   ```bash
   pip install -r requirements.txt
   ```
4. Konfigurasikan Environment Variables:
   Buat file `.env` di folder `backend/` dengan parameter berikut:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/sm_tracker
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_DB=0
   CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
   STOCKBIT_ACCESS_TOKEN=your_token_optional
   ```
5. Jalankan server backend (Development):
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   API docs interaktif Swagger UI akan tersedia di: `http://localhost:8000/docs`

---

### 3. Setup Frontend (Next.js 16)

1. Masuk ke direktori frontend:
   ```bash
   cd frontend
   ```
2. Pasang dependensi Node.js:
   ```bash
   npm install
   ```
3. Konfigurasikan Environment Variables:
   Buat file `.env.local` di folder `frontend/` dengan konfigurasi berikut:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret_key_32_chars_min
   GOOGLE_CLIENT_ID=your_google_oauth_client_id
   GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
   ADMIN_EMAILS=admin@example.com,lead@investowl.com
   ```
4. Jalankan aplikasi frontend (Development):
   ```bash
   npm run dev
   ```
   Aplikasi akan aktif di `http://localhost:3000`.

5. Melakukan Build untuk Produksi:
   ```bash
   npm run build
   npm run start
   ```

---

## 📖 Panduan Penggunaan Aplikasi (User Manual)

### 1. Alur Masuk & Autentikasi Pengguna
1. Akses `http://localhost:3000`. Pengguna yang belum login akan diarahkan ke halaman `/login`.
2. Klik tombol **"Masuk dengan Google"** untuk melakukan autentikasi SSO.
3. **Persetujuan Akun (Approval Gate)**:
   - Jika akun Anda baru pertama kali login dan belum berstatus *Active*, Anda akan diarahkan ke halaman tunggu `/pending`.
   - Administrator yang email-nya terdaftar di `ADMIN_EMAILS` dapat mengakses `/admin` untuk menyetujui (*Approve*) atau menolak permohonan akses pengguna.
   - Setelah disetujui, sesi otomatis terverifikasi dan pengguna dapat mengakses seluruh fitur analitik.

---

### 2. Beranda & Quick Market Monitor (`/`)
- **Tampilan Pasar**: Menampilkan ringkasan pergerakan IHSG dan kartu pergerakan saham favorit (*Watchlist*).
- **Pencarian Cepat Ticker**: Gunakan bilah pencarian atau tekan shortcut keyboard untuk mengetik kode emiten (contoh: `BBCA`, `BBRI`, `ASII`, `TLKM`).
- **Informasi Kartu Emiten**: Menampilkan harga terakhir, perubahan persentase, estimasi akumulasi bandar, dan status dominasi net buy/sell asing.

---

### 3. Halaman Detail Emiten (`/[ticker]`)
Saat membuka emiten tertentu (misal: `/BBCA`), halaman menyediakan 5 tab analitik mendalam yang di-load secara dinamis (*code-split*):

1. **Tab Ringkasan & Candlestick**:
   - Menampilkan grafik candlestick interaktif (Lightweight Charts) lengkap dengan indikator volume transaksi dan anotasi sinyal.
2. **Tab Broker Flow**:
   - Memetakan transaksi broker pembeli (*buyer*) dan penjual (*seller*) berdasarkan tipe partisipan:
     - **Foreign**: Broker asing (ZP, CS, BK, RX, AK, KZ, dll.)
     - **Institutional Domestic**: Broker sekuritas institusi lokal (CC, NI, OD, DX, dll.)
     - **Government**: Broker sekuritas BUMN/pemerintah (IF, LG, dll.)
     - **Retail**: Broker dengan dominasi nasabah ritel (XC, YP, PD, KK, XL, dll.)
3. **Tab Akumulasi / Distribusi**:
   - Tabel agregasi akumulasi Top-1, Top-3, dan Top-5 broker beserta volume dan nilai total rupiah (Gross & Net).
4. **Tab Raw Transaction Tables**:
   - Rincian tabel mentah seluruh broker yang aktif bertransaksi pada rentang tanggal yang dipilih.
5. **Tab Foreign Flow Deep Dive**:
   - **Broker Heatmap**: Matriks intensitas nilai transaksi antar-broker.
   - **Broker Network Graph**: Graf interaktif hubungan alur jual-beli antara broker akumulator dan distributor.
   - **HMM Regime Probabilities**: Diagram probabilitas rezim pasar (State 0: Distribusi, State 1: Netral, State 2: Akumulasi Kuat).
   - **VAR Impulse Response Function**: Grafik respons return saham terhadap guncangan (*shock*) net foreign flow selama rentang waktu $T+k$ hari bursa.
6. **Tab Validasi**:
   - Validasi integritas data broker summary dan keseimbangan counterparty (Gross Buy vs Gross Sell balance).

---

### 4. Analisis Makro Arus Asing (`/foreign`)
- Menampilkan grafik komparasi pergerakan IHSG terhadap kumulatif arus kas investor asing (*Cumulative Foreign Net Inflow*).
- Mendeteksi anomali perputaran sektor (*sector rotation*) yang sedang dibeli secara masif oleh dana asing.

---

### 5. Multi-Layer AI Signal Scanner (`/signal`)
- Menampilkan daftar emiten yang lolos kualifikasi algoritma deteksi sinyal.
- **Lapisan Penilaian (Composite Score 0 - 100)**:
  - *Technical*: Breakout level, Moving Average alignment, RSI/Stochastic momentum.
  - *Smart Money*: Rasio akumulasi Top-3 broker vs total volume transaksi.
  - *Sector*: Momentum sektor saham relatif terhadap indeks sektoral.
  - *Fundamental*: Pertumbuhan laba, solvabilitas, dan valuasi (dengan penalti jika bermasalah).
- **Layer Toggle Pills**:
  - Pengguna dapat mengaktifkan atau menonaktifkan filter layer tertentu (contoh: hanya melihat saham yang lolos layer *Smart Money* dan *Technical*).
- **Rezim Pasar Otomatis**: Ambang batas skor menyesuaikan kondisi pasar (misal: threshold skor minimum 37 pada kondisi pasar *Bearish*).

---

### 6. Terminal Log Emulator (`/logs`)
- Antarmuka pemantau log sistem terpadu.
- Pilihan tab log:
  - `General Log`: Log aplikasi umum dan request API.
  - `Bandarmology Worker`: Log proses scraping dan perhitungan bandarmologi.
  - `Ingestion Task`: Log pembaruan data OHLCV harian.
  - `System Errors`: Riwayat exception dan stack trace.
- Dilengkapi tombol *Syncing/Refresh* langsung dari antarmuka web.

---

## 🛠️ Dokumentasi Perubahan & Optimasi Arsitektur (Changelog)

Proses refactoring komprehensif telah dilakukan untuk mencapai performa tertinggi (**secepat kilat**) tanpa mengubah logika bisnis, rumus matematis, atau tampilan visual antarmuka:

### 1. Eliminasi Dead Code & Pembersihan Boilerplate (Commit `94485c4`)
- **Penghapusan Komponen Mati**: Menghapus komponen yang tidak lagi memiliki referensi: `BrokerDetails.tsx`, `MainChart.tsx`, `Watchlist.tsx`, `ConditionalBottomNav.tsx`, `GlobalSearch.tsx`, dan `Tabs.tsx`.
- **Pembersihan Asset Statis**: Menghapus file SVG boilerplate bawaan Next.js (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) dari direktori `public/`.
- **Pembersihan Dependency**: Menghapus jembatan usang `backend/app/idx_bridge.py` serta menghapus paket `plotly` yang tidak digunakan dari `backend/requirements.txt`.

### 2. Restrukturisasi Folder & Prinsip DRY (Commit `a3d4c4b`)
- **Pembersihan App Router**: Memindahkan komponen analitik foreign flow dari `frontend/app/components/ff/` ke direktori komponen yang tepat: `frontend/components/foreign/`.
- **Sentralisasi Formatter**: Membuat modul utilitas tunggal `frontend/lib/format.ts` (`fmtRp`, `fmtPct`, `signedColor`, `signalColor`, `getProfileTextColor`), mengeliminasi duplikasi logika pemformatan angka di 6 file berbeda.
- **Penyatuan Router Backend**: Menyelaraskan lokasi router bandarmologi ke `backend/routers/bandarmology.py` dengan menyediakan stub re-export di `backend/app/routers/bandarmology.py` untuk menjaga *backward compatibility*.
- **Pembersihan `sys.path`**: Memindahkan `backend/src/services/foreign_analytics.py` ke `backend/services/foreign_analytics.py` dan meniadakan manipulasi `sys.path.insert`.

### 3. Optimasi Performa Ekstrem (Commit `132109f`)
- **Dynamic Code-Splitting Tab Analitik**: Menerapkan `next/dynamic` dengan skeleton loading untuk 5 tab analitik berat di `frontend/app/[ticker]/page.tsx`. Bundle awal halaman ticker mengecil drastis dan hanya memuat modul tab saat tab tersebut dibuka pengguna.
- **Eliminasi Delay Buatan**: Menghapus `setTimeout(1200)` buatan pada `frontend/app/page.tsx` sehingga halaman utama me-render data seketika (**0 ms** overhead).
- **SWR Request Deduplication**: Mengonfigurasi `dedupingInterval: 60000` pada SWR untuk mencegah request API redundan saat komponen me-render ulang.
- **Pencegahan Memory Leak Backend**: Membuat kelas `BoundedTTLCache` berbasis LRU dan TTL di `backend/core/cache.py`, menggantikan 4 dictionary global unbounded di `bandarmology.py` dan `broker_api.py` yang sebelumnya rentan memicu OOM (Out Of Memory).
- **Lazy Module Proxying**: Menerapkan proxy `_LazyModule` di `backend/idx_bandarmology/analysis.py` untuk pustaka visualisasi (`matplotlib` & `plotly`), memangkas waktu inisialisasi modul dari **988 ms menjadi < 1 ms**.
- **Database Query Push-Down**: Menambahkan filter `start_date` langsung pada level kueri SQL di endpoint `ticker_detail`, menghindari pemuatan baris historis yang tidak relevan ke memori Python.
- **Build Optimization**: Mengaktifkan `experimental.optimizePackageImports` untuk `@iconify/react` dan `compiler.removeConsole` pada `next.config.ts`.

### 4. Sinkronisasi Upstream & Integrasi Log Viewer
- Melakukan sinkronisasi (*rebase*) terhadap 5 commit remote terbaru: router `system.py`, UI terminal log viewer `/logs`, dan toggle pills layer scanner pada `SignalDashboard.tsx`.

### 5. Suite Pengujian Regresi Otomatis (Commit `471707b`)
- Menambahkan `backend/tests/test_api_regression.py` yang memvalidasi integritas endpoint root, routing prefix, klasifikasi profil broker, ketahanan cache LRU, dan resolusi universe saham.

---

### Ringkasan Metrik Evaluasi Performa

| Metrik Evaluasi | Kondisi Awal | Kondisi Setelah Optimasi | Dampak / Peningkatan |
| :--- | :---: | :---: | :--- |
| **Delay Render Beranda** | ~1.200 ms (Artifisial) | **0 ms (Instant)** | **100% delay tereliminasi** |
| **Waktu Import Modul Analisis** | ~988 ms | **< 1 ms** | **99.9% lebih cepat (Lazy Load)** |
| **Manajemen Memori Backend** | Unbounded `dict()` (Rentan OOM) | **Bounded LRU Cache + TTL** | **Bebas dari Memory Leak** |
| **Bundle Initial Ticker Page** | Eager (Semua 5 tab dimuat) | **Dynamic Code Splitting** | **FCP & TBT lebih responsif** |
| **Query I/O Database** | Full historic fetch + memory slice | **SQL WHERE start_date push-down** | **Menghemat bandwidth DB** |
| **Backend Test Coverage** | 7 tests (Unit core) | **12 tests (Unit + Regresi API)** | **100% lulus (22.02 detik)** |

---

## 🗂️ Struktur Direktori Codebase

```text
Re-Tracker/
├── .github/
│   └── workflows/
│       └── backend-ci.yml             # CI Pipeline GitHub Actions
├── backend/                           # Backend Service (Python / FastAPI)
│   ├── app/                           # Sub-modul bridge & router bandarmologi
│   │   ├── idx_bridge.py              # Jembatan re-export paket idx_bandarmology
│   │   └── routers/
│   │       └── bandarmology.py        # Controller analitik bandarmologi
│   ├── idx_bandarmology/              # Quantitative & Ingestion Engine
│   │   ├── analysis.py                # Profil broker & korelasi
│   │   ├── broker_api.py              # Klien API broker data (Stockbit Exodus)
│   │   ├── config.py                  # Konfigurasi modul bandarmologi
│   │   ├── features.py                # Feature engineering
│   │   ├── pipeline.py                # Pipeline orkestrasi ETL
│   │   ├── prices.py                  # Scraper OHLCV data
│   │   ├── storage.py                 # Persistensi data SQLAlchemy
│   │   └── universe.py                # Resolusi master universe saham IDX
│   ├── routers/                       # Modul Endpoint API FastAPI
│   │   ├── auth.py                    # Autentikasi & manajemen approval user
│   │   ├── broker.py                  # Endpoint time-series broker
│   │   ├── foreign_flow.py            # Endpoint analitik foreign flow
│   │   ├── signal.py                  # Endpoint AI composite signal
│   │   ├── stocks.py                  # Endpoint candlestick OHLCV
│   │   └── system.py                  # Endpoint log viewer & sistem status
│   ├── src/
│   │   └── services/
│   │       └── foreign_analytics.py   # Model matematika: HMM, VAR IRF, & HHI
│   ├── tests/                         # Suite Pengujian Kualitas
│   │   ├── test_bandarmology.py       # Pengujian algoritma greedy matching
│   │   └── test_foreign_analytics.py  # Pengujian model ML HMM & VAR
│   ├── config.py                      # Pydantic global settings
│   ├── database.py                    # Koneksi & session pool SQLAlchemy
│   ├── main.py                        # Entry point FastAPI & middleware
│   ├── models.py                      # Definisi tabel ORM
│   ├── requirements.txt               # Manifest dependensi Python
│   └── schemas.py                     # Schema validasi Pydantic
├── frontend/                          # Client Web (Next.js 16 / React 19)
│   ├── app/                           # Next.js App Router
│   │   ├── components/                # Komponen lokal App Router
│   │   │   ├── ff/                    # Visualisasi Foreign Flow (Heatmap, HMM, VAR)
│   │   │   ├── fmt.ts                 # Utilitas pemformatan angka
│   │   │   ├── MetricCard.tsx         # Kartu metrik
│   │   │   └── ui/Tabs.tsx            # Komponen tabs
│   │   ├── [ticker]/page.tsx          # Halaman ticker detail
│   │   ├── admin/page.tsx             # Halaman Admin User Approval
│   │   ├── foreign/page.tsx           # Halaman Foreign Flow Makro
│   │   ├── login/page.tsx             # Halaman Login Google SSO
│   │   ├── logs/page.tsx              # Halaman Terminal Log Emulator
│   │   ├── pending/page.tsx           # Halaman Tunggu Verifikasi Akun
│   │   ├── signal/page.tsx            # Halaman Dashboard Signal Multi-Layer
│   │   ├── layout.tsx                 # Root layout & theme provider
│   │   └── page.tsx                   # Beranda & Quick Market Monitor
│   ├── components/                    # Komponen Modular
│   │   ├── analysis/                  # Tab komponen analitik detail ticker
│   │   ├── home/                      # Komponen kartu ticker beranda
│   │   ├── layout/                    # Layout shell (Sidebar, Navbar)
│   │   ├── signal/SignalDashboard.tsx # Tabel sinyal & layer toggle filter
│   │   ├── BrokerDetails.tsx          # Rincian transaksi broker
│   │   ├── MainChart.tsx              # Candlestick chart TradingView
│   │   ├── Watchlist.tsx              # Daftar pantauan
│   │   └── ui/InvestOwlLoader.tsx     # Komponen UI animasi burung hantu
│   ├── lib/
│   │   └── api.ts                     # SWR fetcher sentral
│   ├── next.config.ts                 # Konfigurasi Next.js & Turbopack
│   ├── package.json                   # Dependensi JavaScript/TypeScript
│   └── tailwind.config.ts             # Konfigurasi tema token MD3
├── CHANGELOG.md                       # Riwayat perubahan & optimasi arsitektur
├── PANDUAN_PENGGUNAAN.md              # Panduan detail penggunaan fitur & operasional
└── README.md                          # Panduan utama repositori
```

---

## 📡 Referensi API Endpoint

| Method | Endpoint | Keterangan |
| :---: | :--- | :--- |
| `GET` | `/` | Health check dasar API & informasi versi. |
| `GET` | `/api/health` | Status database & tanggal data broker terakhir. |
| `GET` | `/api/v1/stocks/{ticker}` | Mengambil data harga historis OHLCV. |
| `GET` | `/api/v1/broker/{ticker}` | Mengambil data time-series flow broker. |
| `GET` | `/api/v1/auth/me` | Memeriksa status login dan approval user aktif. |
| `GET` | `/api/v1/auth/users` | Daftar pengguna yang terdaftar (Khusus Admin). |
| `POST`| `/api/v1/auth/approve/{id}`| Menyetujui akses akun pengguna (Khusus Admin). |
| `GET` | `/api/bandar/detail/{ticker}`| Analitik bandarmologi lengkap (Broker summary, Top-N). |
| `GET` | `/api/foreign-flow/{ticker}` | Analitik mendalam foreign flow (HMM, VAR IRF, HHI). |
| `GET` | `/api/signal/` | Daftar sinyal saham yang terdeteksi AI. |
| `GET` | `/api/system/logs/{type}` | Mengambil log sistem secara real-time. |

---

## 🧪 Pengujian & Verifikasi Kualitas

### 1. Menjalankan Backend Test Suite
Suite pengujian backend menggunakan `pytest`. Pastikan environment virtual aktif:
```bash
cd backend
python3 -m pytest tests/ -v
```

Hasil verifikasi:
```text
tests/test_api_regression.py::test_root_endpoint PASSED                  [  8%]
tests/test_api_regression.py::test_registered_routes PASSED              [ 16%]
tests/test_api_regression.py::test_broker_profile_classification PASSED  [ 25%]
tests/test_api_regression.py::test_bounded_ttl_cache_eviction PASSED     [ 33%]
tests/test_api_regression.py::test_universe_resolution PASSED            [ 41%]
tests/test_bandarmology.py::test_single_day_greedy_matching PASSED       [ 50%]
tests/test_bandarmology.py::test_multi_day_date_range_aggregation PASSED [ 58%]
tests/test_bandarmology.py::test_empty_or_out_of_range PASSED            [ 66%]
tests/test_bandarmology.py::test_empty_dataframe_input PASSED            [ 75%]
tests/test_foreign_analytics.py::test_hmm_regime_shape PASSED            [ 83%]
tests/test_foreign_analytics.py::test_var_irf_computation PASSED         [ 91%]
tests/test_foreign_analytics.py::test_foreign_hhi_logic PASSED           [100%]

============================= 12 passed in 22.02s ==============================
```

### 2. Memverifikasi Build Frontend
Pastikan kompilasi TypeScript dan Turbopack berjalan tanpa error:
```bash
cd frontend
npm run build
```

Semua 10 rute static & dynamic ter-generate sempurna dengan status **Compiled successfully** dan 0 TypeScript errors.

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **MIT**. Hak cipta dilindungi undang-undang.
