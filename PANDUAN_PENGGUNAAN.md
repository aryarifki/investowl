# Panduan Penggunaan Aplikasi Re-Tracker (The Investowl) 🦉📘

Selamat datang di **Panduan Penggunaan Aplikasi Re-Tracker (The Investowl)**. Dokumen ini disusun sebagai pedoman operasional lengkap bagi pengguna, trader, analis kuantitatif, dan administrator dalam memanfaatkan seluruh fitur platform analitik pasar modal Bursa Efek Indonesia (IDX).

---

## 📑 Daftar Isi
1. [Akses & Otentikasi Pengguna](#1-akses--otentikasi-pengguna)
2. [Halaman Beranda & Quick Market Monitor](#2-halaman-beranda--quick-market-monitor)
3. [Analisis Detail Saham (Deep-Dive Ticker)](#3-analisis-detail-saham-deep-dive-ticker)
4. [Matriks Grup Konglomerasi IDX](#4-matriks-grup-konglomerasi-idx)
5. [Analisis Makro & Deep Dive Arus Asing](#5-analisis-makro--deep-dive-arus-asing)
6. [AI Multi-Layer Signal Scanner](#6-ai-multi-layer-signal-scanner)
7. [Terminal Live System Logs](#7-terminal-live-system-logs)
8. [Panel Administrasi (User Approval Gate)](#8-panel-administrasi-user-approval-gate)
9. [Tips & Best Practices Penggunaan](#9-tips--best-practices-penggunaan)

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

Halaman utama dirancang untuk memberikan tinjauan pasar secara instan (*bird's-eye view*) dengan latensi muat awal **0 ms**:

- **Pencarian Cepat Emiten**:
  - Gunakan kolom pencarian di bagian atas atau tekan shortcut keyboard untuk membuka dialog pencarian cepat.
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

Saat Anda memilih suatu emiten (misal: membuka `http://localhost:3000/BBCA`), aplikasi menyajikan antarmuka analitik tingkat lanjut yang dibagi ke dalam 6 tab modular yang di-load secara dinamis (*code-split* menggunakan `next/dynamic`):

### A. Header Identitas Emiten
- Menampilkan nama emiten, tanggal analisis aktif, dan rentang *window lookback* (misal: 20 hari perdagangan bursa).
- Indikator ringkasan sinyal bandar (*Bandar Signal Score*, *Dominance*, *Buyer/Seller Concentration Ratio*).

### B. Tab 1: Overview (Smart Money Dashboard)
Tab utama yang merangkum kesehatan aliran modal pada emiten:
1. **Smart-Money Daily Flow Chart**:
   - Diagram batang interaktif pergerakan beli/jual bersih smart money harian (*smart_net*).
   - Garis biru (*cumulative_net*) yang memperlihatkan tren akumulasi kumulatif sepanjang rentang analisis.
2. **Profile Net Flow Distribution**:
   - Distribusi proporsi akumulasi/distribusi berdasarkan profil pasar:
     - **Foreign Smart Money** (Asing)
     - **Local Institutional** (Institusi Lokal)
     - **Market Maker** (Penggerak Pasar)
     - **Speculative Retail** (Trader Ritel)
3. **Broker Detail by Profile Table**:
   - Rincian tabel per broker mencakup profil, tipe broker, total buy value, sell value, net value, frekuensi transaksi, jumlah hari aktif, dan nilai rata-rata per transaksi (*Avg/Tx*).

### C. Tab 2: Broker Flow
Tab ini membedah aliran transaksi broker harian secara mendalam:
- **Pengelompokan Tipe Partisipan**:
  - **Foreign**: Broker sekuritas asing (contoh: ZP, CS, BK, RX, AK, KZ).
  - **Institutional Domestic**: Broker sekuritas institusi lokal (contoh: CC, NI, OD, DX).
  - **Government**: Sekuritas berstatus pelat merah / BUMN (contoh: IF, LG).
  - **Retail**: Sekuritas yang didominasi trader ritel individu (contoh: XC, YP, PD, KK, XL).
- **Visualisasi Net Volume & Value**:
  - Mengidentifikasi broker yang sedang menjadi penyerap utama (*accumulator*) dan pelepas barang (*distributor*).

### D. Tab 3: Causality (Smart Money vs Retail)
- Menganalisis korelasi kausalitas arah transaksi antara partisipan Smart Money vs partisipan ritel.
- Membantu mengenali apakah pergerakan harga didorong oleh akumulasi terencana institusi atau sekadar FOMO ritel jangka pendek.

### E. Tab 4: Validation (Integritas Data)
- Memvalidasi konsistensi counterparty: memastikan total nilai beli broker sama persis dengan total nilai jual broker (*Gross Buy = Gross Sell* balance).
- Rekonsiliasi data broker summary untuk menjamin integritas data (*zero missing data guarantee*).

### F. Tab 5: Screener
- Alpha screener terintegrasi yang menyaring saham berdasarkan kriteria likuiditas, volatilitas, dan akumulasi bandar.
- Terkoneksi dengan watchlist lokal browser (*LocalStorage*) untuk pemantauan portofolio personal.

### G. Tab 6: Raw Transaction Tables
- Tabel data mentah yang menyajikan seluruh broker yang aktif bertransaksi pada tanggal atau rentang tanggal yang dipilih.
- Kolom mencakup: Kode Broker, Tipe, Buy Lot, Buy Value, Buy Avg Price, Sell Lot, Sell Value, Sell Avg Price, dan Net Value.

---

## 4. Matriks Grup Konglomerasi IDX (`/konglo`)

Fitur khusus untuk memantau aliran dana dan rotasi kapital antar-konglomerasi ekonomi terbesar di Bursa Efek Indonesia:

### A. 8 Grup Konglomerasi yang Dilacak
1. **Grup Djarum (Keluarga Hartono)**:
   - Emiten: `BBCA`, `TOWR`, `BELI`, `RANC`.
   - Karakteristik: Pemimpin industri perbankan swasta nasional dan infrastruktur telekomunikasi.
2. **Grup Barito (Prajogo Pangestu)**:
   - Emiten: `BREN`, `BRPT`, `TPIA`, `CUAN`, `PTRO`.
   - Karakteristik: Raksasa energi baru terbarukan, petrokimia, dan diversifikasi tambang.
3. **Grup Astra (Jardine Matheson / Publik)**:
   - Emiten: `ASII`, `UNTR`, `AUTO`, `ASGR`, `AALI`.
   - Karakteristik: Konglomerasi otomotif, alat berat, agribisnis, dan pembiayaan.
4. **Grup Salim (Anthoni Salim)**:
   - Emiten: `INDF`, `ICBP`, `LSIP`, `SIMP`, `AMMN`.
   - Karakteristik: Ekosistem konsumsi hulu-hilir terbesar dan tambang emas/tembaga.
5. **Grup Sinarmas (Keluarga Widjaja)**:
   - Emiten: `INKP`, `TKIM`, `SMMA`, `BSDE`, `DMAS`.
   - Karakteristik: Produsen pulp & paper kelas dunia, properti kota mandiri, dan jasa keuangan.
6. **Grup Bakrie (Keluarga Bakrie)**:
   - Emiten: `BUMI`, `BRMS`, `DEWA`, `ENRG`, `VKTR`.
   - Karakteristik: Pertambangan batubara & mineral skala masif, energi, dan infrastruktur.
7. **BUMN Perbankan (Bank Himbara)**:
   - Emiten: `BBRI`, `BMRI`, `BBNI`, `BBTN`.
   - Karakteristik: Pilar perbankan negara penopang likuiditas dan pembiayaan nasional.
8. **BUMN Sumber Daya Alam (MIND ID & Pertamina)**:
   - Emiten: `PGAS`, `ANTM`, `PTBA`, `TINS`, `ELSA`.
   - Karakteristik: Holding tambang dan energi strategis nikel, gas bumi, emas, dan batubara.

### B. Cara Membaca Analisis Konglomerasi
- **Tab Pemilih Grup**: Klik grup konglomerasi di bilah atas untuk menampilkan emiten-emiten yang berada di bawah naungan grup tersebut.
- **Ticker Mini-Card**: Setiap kartu menyajikan harga terkini, perubahan persentase harian, sinyal akumulasi Smart Money, dan total net flow 20 hari perdagangan.
- **Deteksi Rotasi Modal**: Jika emiten perbankan Himbara mulai mengalami distribusi bersamaan dengan aliran akumulasi masif pada emiten komoditas (misal: Grup Barito atau BUMN SDA), ini mengindikasikan adanya rotasi modal sektoral antar-grup konglomerat.

---

## 5. Analisis Makro & Deep Dive Arus Asing (`/foreign`)

Halaman ini didedikasikan untuk memantau pergerakan arus modal asing secara makro maupun mikro kuantitatif:

### A. IHSG vs Cumulative Foreign Flow
- Grafik perbandingan overlay antara pergerakan Indeks Harga Saham Gabungan (IHSG) dengan akumulasi bersih dana asing (*Cumulative Foreign Net Inflow*).
- Membantu trader mengidentifikasi apakah tren kenaikan IHSG didukung oleh likuiditas asing riil atau sekadar kenaikan tanpa partisipasi dana institusi global (*bearish divergence*).

### B. Foreign Flow Deep Dive Analytics
Model matematika kuantitatif tingkat lanjut untuk membedah transaksi dana asing:
1. **Broker Heatmap**:
   - Matriks intensitas interaksi transaksi bilateral antar-broker berbasis Apache ECharts. Semakin terang warnanya, semakin masif nilai perdagangan antar-broker tersebut.
2. **Broker Network Graph**:
   - Graf jaringan interaktif yang memetakan keterhubungan alur transaksi antara broker pembeli (*source*) dan penjual (*target*). Ketebalan garis merefleksikan volume transaksi.
3. **Gaussian Hidden Markov Model (HMM) Regime Detection**:
   - Algoritma machine learning unsupervised yang mengklasifikasikan rezim pergerakan pasar ke dalam 3 kondisi laten:
     - **Rezim 0 (Distribusi Berat)**: Tekanan jual asing mendominasi.
     - **Rezim 1 (Netral / Konsolidasi)**: Arus modal asing berada dalam keseimbangan.
     - **Rezim 2 (Akumulasi Kuat)**: Inflow dana asing terkonsentrasi secara agresif.
4. **Vector Autoregression (VAR) Impulse Response Function (IRF)**:
   - Menghitung kurva respons return saham terhadap guncangan (*shock*) 1 standar deviasi dari net foreign buy sepanjang horizon waktu $T+1$ hingga $T+20$ hari bursa.
   - Kurva positif mengonfirmasi bahwa akumulasi asing memiliki korelasi kausal signifikan dalam mendorong apresiasi harga.

---

## 6. AI Multi-Layer Signal Scanner (`/signal`)

Modul pemindai sinyal saham berbasis kuantitatif multi-layer adaptif:

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

## 7. Terminal Live System Logs (`/logs`)

Antarmuka pemantau log aplikasi secara real-time yang menyerupai emulator terminal Linux:
- **Pilihan Kategori Log**:
  - `General Log`: Catatan request HTTP API dan respons sistem.
  - `Bandarmology Worker`: Riwayat kalkulasi dan matching transaksi broker.
  - `Ingestion Task`: Status scraping data harian dari bursa.
  - `System Errors`: Log galat runtime dan warning exception.
- **Tombol Syncing**:
  - Klik tombol **Syncing / Refresh** di pojok kanan atas untuk memperbarui log secara instan tanpa me-reload halaman.

---

## 8. Panel Administrasi (User Approval Gate) (`/admin`)

Khusus untuk pengguna yang email-nya terdaftar di variabel lingkungan `ADMIN_EMAILS`:
- **Tabel Daftar Pengguna**:
  - Menampilkan seluruh pengguna yang telah login ke aplikasi beserta nama, email, waktu pendaftaran, dan status akun (`Pending`, `Active`, atau `Rejected`).
- **Aksi Administrator**:
  - Klik tombol **"Approve"** berwarna hijau untuk memberikan izin akses penuh kepada pengguna yang berstatus pending.
  - Klik tombol **"Reject"** untuk menolak permohonan akses.

---

## 9. Tips & Best Practices Penggunaan

1. **Konfirmasi Sinyal Multi-Layer**:
   - Selalu cari emiten yang memiliki konvergensi positif antara **Smart Money Score > 60** dan **Technical Score > 60**. Kenaikan harga yang didukung akumulasi bandar memiliki probabilitas keberhasilan lebih tinggi dibanding breakout teknikal murni tanpa akumulasi volume.
2. **Periksa Kausalitas VAR IRF**:
   - Sebelum memutuskan *swing trade* pada saham berbasis foreign flow, buka tab *Foreign Flow Deep Dive* dan periksa grafik VAR IRF. Pastikan kurva respons bernilai positif hingga horizon $T+5$ atau $T+10$.
3. **Analisis Rotasi Konglomerasi**:
   - Gunakan halaman `/konglo` untuk mengamati ke mana likuiditas besar berotasi. Sering kali kenaikan saham dalam satu konglomerasi diawali oleh akumulasi pada emiten induk (*holding company*) sebelum merambat ke anak usaha.
4. **Hindari Jebakan Distribusi Ritel**:
   - Jika harga saham naik namun tabel broker flow didominasi oleh pembelian broker ritel (YP, PD, XC) sementara sekuritas institusi melakukan distribusi masif, waspadai potensi *distribution trap* / *bull trap*.
