# 📦 Arsip Halaman: System Logs & Job Monitor (`/logs`)

> **Status:** Diarsipkan dari aplikasi aktif (Non-aktif dalam proses build Next.js).  
> **Tanggal Pengarsipan:** 13 Oktober 2026  
> **Tujuan:** Menyimpan kode sumber asli dan dokumentasi komprehensif seluruh fungsi pemantau log dan trigger job cron SMtracker sebelum digantikan oleh fitur utama **Dashboard Nyangkut**.

---

## 1. Ringkasan Fitur Halaman Logs

Halaman ini sebelumnya berfungsi sebagai **Control Center & Real-time Log Viewer** untuk seluruh proses background dan pipeline data analitik di Investowl / SMtracker. Halaman ini memungkinkan administrator untuk:
1. Memantau status proses background (PID, runtime, exit code, status running/idle/failed/success).
2. Menjalankan (*Trigger*) dan menghentikan (*Stop*) pipeline data secara manual melalui UI.
3. Mengonfigurasi parameter eksekusi (Universe emiten, lookback window, tahun/kuartal fundamental, opsi DB vacuum/autofix).
4. Membaca output terminal log file secara real-time dengan fitur auto-scroll dan copy-to-clipboard.
5. Menghapus (*Clear*) log file historis.

---

## 2. Struktur File Arsip

```
investowl/archive/frontend_logs/
├── page.tsx    # Source code React (Next.js 16 Client Component) halaman logs
└── README.md   # Dokumentasi arsitektur, parameter job, dan panduan restorasi
```

---

## 3. Daftar Job SMtracker & Parameter yang Didukung

Halaman ini terintegrasi dengan 9 jenis background worker di SMtracker:

| Key Job | Label | Kategori | Parameter yang Didukung |
| :--- | :--- | :--- | :--- |
| `backfill` | Daily Backfill | Harian | `universe` (all/liquid/custom), `window` (standard/deep), `days` (integer), `force` (boolean) |
| `db_audit` | DB Health Audit | Harian | `autofix` (boolean), `vacuum` (boolean), `notify` (boolean), `alert_only` (boolean) |
| `etl_flow` | ETL Foreign Flow | Harian | Menjalankan ekstraksi dan agregasi broker flow asing |
| `scanner` | Scanner AI | Harian | Algoritma pemindai Wyckoff + Smart Money flow |
| `auditor` | Auditor Telegram | Harian | Evaluasi sinyal trading OPEN & evaluasi TP/SL ke Telegram |
| `pipeline` | Full Pipeline | Otomatis | Menjalankan seluruh rantai end-to-end pipeline |
| `backfill_monthly` | Monthly Backfill | Periodik | `months` (last3/last6/all/kustom format YYYY-MM) |
| `backfill_fundamentals` | Fundamentals & Governance | Periodik | `year`, `quarter`, `details`, `only_missing`, `ratios`, `actions` |
| `backup` | Backup Database | Maintenance | Membuat snapshot database terkompresi |

---

## 4. Integrasi Backend API

Halaman ini berinteraksi dengan router FastAPI di backend (`/root/investowl/backend/routers/system.py`):

1. **`GET /api/logs/jobs/status`**
   - Mengambil status terkini seluruh job (running, PID, elapsed time, exit code).
   - Polling dinamis: 2.5 detik saat ada proses running, 8 detik saat idle.
2. **`GET /api/logs/history?job={jobKey}`**
   - Mengambil daftar file log historis untuk tab job tertentu beserta ukuran file dan waktu modifikasi.
3. **`GET /api/logs/view?filename={filename}`**
   - Mengambil isi konten log teks (dengan pembatasan baris/ukuran untuk performa).
4. **`GET /api/logs/daily`**
   - Mengambil log harian dari `cron_daily.log` atau agregat pipeline.
5. **`POST /api/logs/jobs/{jobKey}/run`**
   - Memicu eksekusi subprocess dengan parameter query string.
6. **`POST /api/logs/jobs/{jobKey}/stop`**
   - Mengirim sinyal `SIGTERM` / `SIGKILL` ke PID proses yang sedang aktif.
7. **`POST /api/logs/clear`**
   - Mengosongkan file log yang dipilih.
8. **`POST /api/logs/cache/purge?pattern=*`**
   - Membersihkan Redis cache global aplikasi.

---

## 5. Panduan Pemulihan (Restoration Guide)

Jika halaman ini perlu diaktifkan kembali di masa mendatang (misalnya untuk panel admin internal terpisah):

1. **Pindahkan kembali file halaman:**
   ```bash
   mkdir -p /root/investowl/frontend/app/admin/logs
   cp /root/investowl/archive/frontend_logs/page.tsx /root/investowl/frontend/app/admin/logs/page.tsx
   ```
   *(Saran: Letakkan di bawah rute terproteksi seperti `/admin/logs` agar tidak tercampur dengan halaman publik)*.

2. **Daftarkan rute navigasi:**
   Tambahkan link ke `/admin/logs` pada komponen `frontend/components/layout/Sidebar.tsx` atau `ClientLayout.tsx`.

3. **Pastikan Service Backend Aktif:**
   Pastikan `backend/routers/system.py` tetap terdaftar di `backend/main.py`:
   ```python
   app.include_router(system.router)
   ```
