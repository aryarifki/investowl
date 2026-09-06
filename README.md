# InvestOwl 🦉📈

**InvestOwl** adalah platform *full-stack* komprehensif untuk analisis pasar saham Bursa Efek Indonesia (BEI / IDX), dengan fokus mendalam pada analisis **Bandarmologi**, *broker flow*, dan pemodelan pergerakan harga.

## 🚀 Fitur Utama

*   **Dashboard Interaktif**: Antarmuka pengguna modern yang dibangun dengan Next.js dan Tailwind CSS, menyediakan tab khusus untuk *Overview*, *Broker Flow*, *Causality*, *Screener*, dan *Raw Tables*.
*   **Analisis Bandarmologi**: Melacak jejak akumulasi dan distribusi oleh broker dan institusi (*smart money*) dengan akurasi tinggi.
*   **Screener Saham Terintegrasi**: Endpoint API dan UI khusus untuk menyaring saham berdasarkan parameter teknikal dan aliran dana broker.
*   **Pipeline Data Analitik**: Modul Python kustom (`idx_bandarmology`) untuk mengekstrak data dari API broker, melakukan *feature engineering*, dan mengeksekusi model analitik.
*   **Automasi Ingestion Data**: Skrip `backfill_monthly.py` untuk mengumpulkan, memvalidasi, dan menyinkronkan data historis saham secara berkala.

## 🛠️ Tech Stack

### Frontend
*   **Framework:** Next.js (React) - App Router
*   **Styling:** Tailwind CSS & Komponen UI (berbasis Shadcn UI)
*   **Komponen Spesifik:** Lucide React (Ikon), Charting UI.

### Backend & Data Engine
*   **API Framework:** FastAPI (Python)
*   **Core Engine:** Modul kustom `idx_bandarmology` (Data Scraping, Modeling, Features)
*   **Database Integration:** Modul *session-based* terstruktur (mendukung integrasi PostgreSQL atau database relasional lainnya).
*   **Data Pipeline:** Arsitektur *pipeline* modular untuk pemrosesan harga (`prices.py`) dan *universe* saham (`universe.py`).

## 📂 Struktur Repositori

```text
investowl/
├── app/                    # FastAPI Backend (REST Endpoints, Konfigurasi, DB)
│   ├── api/v1/endpoints/   # Rute API (bandarmology.py, dashboard.py, stocks.py)
│   ├── core/               # Konfigurasi inti aplikasi
│   ├── db/                 # Koneksi & manajemen sesi database
│   ├── schemas/            # Skema Pydantic untuk validasi data
│   └── services/           # Business logic (analysis_service.py)
├── frontend/               # Next.js Frontend Application
│   ├── src/app/            # Konfigurasi routing utama Next.js
│   ├── src/components/     # Komponen UI (Tab Dashboard, Metric Cards, dsb)
│   └── public/             # Aset statis & Ikon
├── src/idx_bandarmology/   # Core Python Package untuk Analisis IDX
│   ├── analysis.py         # Logika perhitungan bandarmologi
│   ├── broker_api.py       # Interaksi dengan API broker eksternal
│   ├── features.py         # Pembentukan fitur untuk permodelan
│   ├── modeling.py         # Pemodelan matematis / kausalitas
│   ├── pipeline.py         # Orkestrasi pemrosesan data pipeline
│   ├── prices.py           # Manajemen data harga historis
│   └── storage.py          # Logika penyimpanan data mentah & terproses
├── backfill_monthly.py     # Skrip pipeline eksekusi pengisian data bulanan
└── requirements.txt        # Daftar dependensi Python backend
```

## 💻 Panduan Instalasi & Menjalankan Aplikasi

### 1. Persiapan Awal
Kloning repositori ke mesin lokal Anda:
```bash
git clone <url-repo-anda>
cd investowl
```

### 2. Setup Backend (FastAPI & Engine)
Pastikan Python telah terinstal dengan baik di sistem Anda. Sangat disarankan menggunakan *virtual environment*.

```bash
# Buat dan aktifkan virtual environment (Linux/Mac)
python -m venv venv
source venv/bin/activate
# Untuk Windows: venv\Scriptsctivate

# Instal seluruh dependensi
pip install -r requirements.txt

# Jalankan server backend FastAPI (biasanya berjalan di port 8000)
uvicorn app.main:app --reload
```

### 3. Setup Frontend (Next.js)
Pastikan Node.js (v18 atau lebih baru) telah terinstal.

```bash
cd frontend

# Instal paket dependensi Node
npm install

# Jalankan development server
npm run dev
```
Buka browser dan akses `http://localhost:3000` untuk melihat antarmuka *dashboard* InvestOwl.

### 4. Mengelola Data (Data Ingestion)
Untuk melakukan pembaruan data pasar saham atau mengisi data bulanan historis, jalankan skrip *backfill* dari *root directory*:
```bash
python backfill_monthly.py
```

## 📄 Lisensi
Distribusi dan hak cipta diatur dalam dokumen [LICENSE](LICENSE) yang terlampir pada repositori ini.
