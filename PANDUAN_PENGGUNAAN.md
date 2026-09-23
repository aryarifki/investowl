# Panduan Penggunaan Aplikasi Re-Tracker (The Investowl) 🦉📘

Selamat datang di **Panduan Penggunaan Aplikasi Re-Tracker (The Investowl)**. Dokumen ini disusun sebagai pedoman operasional lengkap bagi pengguna, trader, analis kuantitatif, dan administrator dalam memanfaatkan seluruh fitur platform.

---

## 📑 Daftar Isi
1. [Akses & Otentikasi Pengguna](#1-akses--otentikasi-pengguna)
2. [Halaman Beranda & Quick Market Monitor](#2-halaman-beranda--quick-market-monitor)
3. [Analisis Detail Saham (Deep-Dive Ticker)](#3-analisis-detail-saham-deep-dive-ticker)
4. [Analisis Makro Foreign Flow](#4-analisis-makro-foreign-flow)
5. [AI Multi-Layer Signal Scanner](#5-ai-multi-layer-signal-scanner)
6. [Terminal Live System Logs](#6-terminal-live-system-logs)
7. [Panel Administrasi (User Approval Gate)](#7-panel-administrasi-user-approval-gate)
8. [Tips & Best Practices Penggunaan](#8-tips--best-practices-penggunaan)

---

## 1. Akses & Otentikasi Pengguna

Platform Re-Tracker menggunakan sistem otentikasi **Single Sign-On (SSO) Google** terintegrasi dengan gerbang persetujuan admin (*Admin Approval Gate*):

1. **Masuk ke Aplikasi**:
   - Buka browser dan arahkan ke alamat web: `http://localhost:3000` (atau domain produksi Anda).
   - Anda akan melihat halaman login bertema burung hantu (*The Investowl*).
   - Klik tombol **"Masuk dengan Google"**.
2. **Status Akun Pending**:
   - Jika akun Anda baru pertama kali didaftarkan, sistem akan secara otomatis mengarahkan Anda ke halaman **`/pending`**.
   - Halaman ini menandakan akun Anda sedang menunggu konfirmasi persetujuan dari Administrator.
3. **Pemberian Izin Akses**:
   - Administrator sistem akan memverifikasi email Anda melalui halaman `/admin`.
   - Begitu disetujui (*Status: Active*), Anda akan langsung mendapatkan akses penuh ke seluruh modul analitik tanpa perlu registrasi ulang.

---

## 2. Halaman Beranda & Quick Market Monitor (`/`)

Halaman utama dirancang untuk memberikan tinjauan pasar secara instan (*bird's-eye view*):

- **Pencarian Cepat Emiten**:
  - Gunakan kolom pencarian di bagian atas atau tekan tombol shortcut untuk membuka dialog pencarian cepat.
  - Masukkan 4 huruf kode saham (misal: `BBCA`, `BBRI`, `ASII`, `BREN`, `AMMN`).
- **Kartu Pantauan Pasar (Watchlist Cards)**:
  - Setiap kartu menampilkan:
    - Harga terakhir (*Last Price*) dan persentase perubahan harian.
    - Status Akumulasi/Distribusi Bandar (*Big Acc*, *Normal Acc*, *Neutral*, *Normal Dist*, *Big Dist*).
    - Status Dominasi Asing (*Foreign Dominance*: Net Buy atau Net Sell).
- **Sorting & Filter Cepat**:
  - Anda dapat mengurutkan saham berdasarkan Top Gainers, Top Losers, Most Accumulated, atau Volume Transaksi Tertinggi.

---

## 3. Analisis Detail Saham (Deep-Dive Ticker) (`/[ticker]`)

Saat Anda memilih suatu emiten (misal: membuka `http://localhost:3000/BBCA`), aplikasi menyajikan antarmuka analitik tingkat lanjut yang dibagi ke dalam beberapa tab:

### A. Header & Grafik Candlestick Utama
- Menampilkan grafik candlestick interaktif **TradingView Lightweight Charts**.
- Dilengkapi volume bar berwarna (hijau untuk candle naik, merah untuk candle turun).
- Terdapat selektor rentang waktu (*Timeframe*: 1M, 3M, 6M, 1Y, YTD).

### B. Tab 1: Broker Flow
Tab ini membedah aliran transaksi broker harian:
- **Pengelompokan Tipe Partisipan**:
  - **Foreign (Asing)**: Broker sekuritas asing (contoh: ZP, CS, BK, RX, AK, KZ).
  - **Institutional Domestic (Institusi Domestik)**: Sekuritas institusi lokal (contoh: CC, NI, OD, DX).
  - **Government (BUMN / Pemerintah)**: Sekuritas berstatus pelat merah (contoh: IF, LG).
  - **Retail (Nasabah Ritel)**: Sekuritas yang didominasi trader ritel individu (contoh: XC, YP, PD, KK, XL).
- **Visualisasi Net Volume & Value**:
  - Mengetahui siapa yang sedang menyerap (*buyer*) dan siapa yang sedang melepas barang (*seller*).

### C. Tab 2: Akumulasi & Distribusi
- **Top-N Broker Concentration Ratio**:
  - Menghitung konsentrasi pembelian oleh Top-1, Top-3, dan Top-5 broker teratas terhadap total volume perdagangan harian.
  - **Kriteria Pembacaan**:
    - **Big Accumulation**: Jika Top-3 broker menguasai > 40% dari total net volume pembelian.
    - **Normal Accumulation**: Jika Top-3 broker menguasai 25% – 40%.
    - **Neutral**: Jika distribusi pembelian dan penjualan merata.
    - **Distribution**: Jika Top-3 broker penjual mendominasi pelepasan saham.

### D. Tab 3: Raw Transaction Tables
- Tabel data mentah yang menyajikan seluruh broker yang aktif bertransaksi pada tanggal yang dipilih.
- Kolom mencakup: Kode Broker, Tipe, Buy Lot, Buy Value, Buy Avg Price, Sell Lot, Sell Value, Sell Avg Price, dan Net Value.

### E. Tab 4: Foreign Flow Deep Dive
Modul analisis matematika kuantitatif khusus transaksi investor asing:
1. **Broker Heatmap**:
   - Matriks intensitas interaksi jual-beli antar broker. Semakin terang warnanya, semakin besar volume transaksi bilateral antar broker tersebut.
2. **Broker Network Graph**:
   - Graf topologi jaringan yang memperlihatkan node-node broker pembeli terhubung dengan node broker penjual. Ketebalan garis mencerminkan besarnya volume transaksi counterparty.
3. **Gaussian Hidden Markov Model (HMM) Regime Detection**:
   - Algoritma machine learning tanpa supervisi yang mengidentifikasi rezim pasar ke dalam 3 kondisi laten:
     - **Rezim 0 (Distribusi Kuat)**: Tekanan jual asing mendominasi.
     - **Rezim 1 (Netral / Konsolidasi)**: Aliran dana asing seimbang.
     - **Rezim 2 (Akumulasi Kuat)**: Inflow dana asing terkonsentrasi secara signifikan.
4. **Vector Autoregression (VAR) Impulse Response Function (IRF)**:
   - Menghitung dampak guncangan (*shock*) positif 1 standar deviasi dari net foreign buy terhadap pergerakan return saham selama 10 hingga 20 hari bursa berikutnya ($T+1$ s/d $T+20$).
   - Jika grafik IRF berada di area positif, berarti akumulasi asing memiliki korelasi kausal yang kuat dalam mendorong harga naik.

### F. Tab 5: Validasi Integritas Data
- Memvalidasi konsistensi counterparty: memastikan total nilai beli broker sama persis dengan total nilai jual broker (*Gross Buy = Gross Sell*).
- Menjamin tidak ada data broker summary yang hilang (*zero missing data guarantee*).

---

## 4. Analisis Makro Foreign Flow (`/foreign`)

Halaman ini ditujukan untuk memantau pergerakan arus modal asing secara makro di pasar saham Indonesia:
- **IHSG vs Cumulative Foreign Flow**:
  - Grafik overlay antara pergerakan Indeks Harga Saham Gabungan (IHSG) dengan akumulasi bersih dana asing dalam rentang bulanan hingga tahunan.
  - Membantu trader mengidentifikasi fase *bull market* yang didukung likuiditas asing vs kenaikan semu (*divergence*).
- **Peta Aliran Sektor**:
  - Menampilkan sektor industri mana saja yang sedang mengalami net inflow tertinggi (misal: Financials, Infrastructure, Energy, Consumer).

---

## 5. AI Multi-Layer Signal Scanner (`/signal`)

Modul pemindai sinyal saham berbasis machine learning dan kuantitatif multi-layer:

### A. Bobot & Lapisan Penilaian (Composite Score 0 – 100)
1. **Technical Layer (Skor 0 - 100)**:
   - Menilai breakout resistance, posisi Moving Average (MA20, MA50, MA200), tren MACD, dan Stochastic/RSI.
2. **Smart Money Layer (Skor 0 - 100)**:
   - Menilai rasio akumulasi broker top-3, konsistensi inflow bandar dalam 5–20 hari terakhir, dan ketiadaan distribusi terselubung.
3. **Sector Layer (Skor 0 - 100)**:
   - Menilai kekuatan relatif emiten terhadap indeks sektoralnya (*Relative Strength*).
4. **Fundamental Layer (Skor 0 - 100)**:
   - Skrining rasio solvabilitas, pertumbuhan laba bersih, dan metrik valuasi (memberikan penalti skor jika rasio utang bermasalah).

### B. Filter Layer Toggle Pills
Di bagian atas tabel hasil scanner, Anda dapat mengaktifkan atau mematikan filter layer tertentu:
- Klik tombol **Technical**, **Smart Money**, **Sector**, atau **Fundamental** untuk menyaring saham yang memenuhi kriteria minimum di layer bersangkutan.

### C. Dynamic Threshold Rezim Pasar
- Algoritma secara adaptif menyesuaikan batas kelolosan sinyal berdasarkan kondisi IHSG.
- Saat pasar berada pada rezim koreksi/bearish, threshold otomatis dikalibrasi (misal: skor komposit minimal 37) untuk menyaring hanya emiten-emiten dengan ketahanan likuiditas terkuat.

---

## 6. Terminal Live System Logs (`/logs`)

Antarmuka pemantau log aplikasi secara real-time yang menyerupai emulator terminal:
- **Pilihan Kategori Log**:
  - `General Log`: Catatan request HTTP API dan respons sistem.
  - `Bandarmology Worker`: Riwayat kalkulasi dan matching transaksi broker.
  - `Ingestion Task`: Status scraping data harian dari bursa.
  - `System Errors`: Log galat runtime dan warning.
- **Tombol Syncing**:
  - Klik tombol **Syncing / Refresh** di pojok kanan atas untuk memperbarui tampilan log secara langsung tanpa me-reload halaman.

---

## 7. Panel Administrasi (User Approval Gate) (`/admin`)

Khusus untuk pengguna yang email-nya terdaftar di variabel lingkungan `ADMIN_EMAILS`:
- **Tabel Daftar Pengguna**:
  - Menampilkan seluruh pengguna yang telah login ke aplikasi beserta nama, email, waktu pendaftaran, dan status akun (`Pending`, `Active`, atau `Rejected`).
- **Aksi Administrator**:
  - Klik tombol **"Approve"** berwarna hijau untuk memberikan izin akses penuh kepada pengguna yang berstatus pending.
  - Klik tombol **"Reject"** untuk menolak permohonan akses.

---

## 8. Tips & Best Practices Penggunaan

1. **Konfirmasi Sinyal Multi-Layer**:
   - Selalu cari emiten yang memiliki konvergensi positif antara **Smart Money Score > 60** dan **Technical Score > 60**. Kenaikan harga yang didukung akumulasi bandar memiliki probabilitas keberhasilan lebih tinggi.
2. **Periksa Kausalitas VAR IRF**:
   - Sebelum memutuskan *swing trade* pada saham berbasis foreign flow, buka tab *Foreign Flow Deep Dive* dan periksa grafik VAR IRF. Pastikan kurva respons bernilai positif hingga horizon $T+5$ atau $T+10$.
3. **Hindari Jebakan Distribusi Ritel**:
   - Jika harga saham naik namun tabel broker flow didominasi oleh pembelian broker ritel (YP, PD, XC) sementara sekuritas institusi melakukan distribusi masif, waspadai potensi *distribution trap* / *bull trap*.
