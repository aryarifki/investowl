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
9. [Asisten Interaktif Telegram & Mobile Command Center](#9-asisten-interaktif-telegram--mobile-command-center)
10. [Tips & Best Practices Penggunaan](#10-tips--best-practices-penggunaan)

---

## 1. Akses & Otentikasi Pengguna

Platform Re-Tracker mengusung prinsip **Akses Terbuka (Guest Mode)** ramah pengguna dengan opsi integrasi **Single Sign-On (SSO) Google**:

1. **Akses Langsung (Guest Mode)**:
   - Anda dapat langsung membuka alamat web `http://localhost:3001` (atau domain produksi) dan langsung mengeksplorasi seluruh fitur dan analitik pasar (Beranda, Detail Emiten, Konglo, Foreign Flow, Whales, Backtest, Signal) tanpa hambatan login.
2. **Login Opsional dengan Google**:
   - Untuk menyimpan daftar pantau saham (*watchlist*) ke cloud database agar tidak hilang saat berganti perangkat atau browser, klik tombol **"Masuk"** di pojok kanan atas navbar.
   - Pilih akun Google Anda. Seluruh pengguna terdaftar otomatis disetujui (*Instant Access*) dan data watchlist Anda akan tersinkronisasi otomatis dengan server.
3. **Pemberian Izin Khusus Administrator**:
   - Panel khusus `/admin` diproteksi untuk pengelolaan sistem lanjutan oleh administrator.

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

Saat Anda memilih suatu emiten (misal: membuka `http://localhost:3001/BBCA`), aplikasi menyajikan antarmuka analitik tingkat lanjut yang dibagi ke dalam 6 tab modular yang di-load secara dinamis (*code-split* menggunakan `next/dynamic`):

### A. Header Identitas Emiten & Bookmark Bintang
- **Tombol Bookmark Bintang (★)**: Terletak tepat di samping kode saham. Klik ikon bintang untuk menambahkan emiten ke watchlist atau menghapusnya secara instan.
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

### C. Peta Jejaring Kepemilikan Saham (Ownership Network Graph)
- **Hierarki Horizontal Tree**: Visualisasi silsilah kepemilikan dirancang dari kiri ke kanan (Konglomerasi $\rightarrow$ Entitas Induk/Holding $\rightarrow$ Emiten Terbuka BEI) untuk kemudahan keterbacaan struktur kepemilikan.
- **Pencarian Cerdas & Autocomplete**: Gunakan kolom pencarian di atas canvas untuk mengetikkan nama emiten (misal: `BBCA`), perusahaan holding (misal: `PT Dwimuria Investama Andalan`), atau grup konglomerat. Klik hasil dari dropdown untuk langsung memperbesar dan memfokuskan layar ke node target.
- **Navigasi Canvas**: Gunakan tombol Zoom In (+), Zoom Out (-), Reset, atau drag mouse/layar sentuh untuk menggeser canvas graf secara fleksibel. Klik node manapun untuk melihat kartu ringkasan detail entitas.

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

## 6. AI Multi-Layer Signal Scanner & Meta-Labeling v1.5 (`/signal`)

> 📖 **Panduan Khusus AI**: Untuk penjelasan mendalam mengenai interpretasi probabilitas AI, ekskursi risiko MAE/MFE, dan money management Kelly, baca **[`PANDUAN_AI_MACHINE_LEARNING.md`](./PANDUAN_AI_MACHINE_LEARNING.md)**.

Modul pemindai sinyal kuantitatif dan rekomendasi posisi berbasis siklus pasar Wyckoff, Minervini VCP, rotasi multi-faktor sektor, serta **AI Dual-Model Meta-Labeling (Gatekeeper & Dynamic Risk Management)**:

### A. Bobot & Lapisan Penilaian Kuantitatif (Composite Score 0 – 100)
1. **Technical Layer (Skor 0 - 100)**:
   - Dihitung menggunakan standar **Wilder's Smoothing RSI (14)** dan **Wilder's ATR (14)** untuk mengeliminasi lag rolling SMA.
   - Menggunakan **Safe-CLV Chaikin Money Flow (CMF 14)** yang tahan terhadap bar datar/suspend ($HL=0$).
   - Konfirmasi posisi harga terhadap Moving Average (MA20, MA50, MA150, MA200).
2. **Smart Money Layer (Skor 0 - 100)**:
   - Menilai rasio partisipasi akumulasi bandar Top-3 broker terhadap volume total.
   - **5-Day Flow Persistence (`persistence_5d`)**: Mengukur konsistensi akumulasi net buy asing dan broker bandar dalam 5 hari bursa berturut-turut.
   - **Signed Foreign Z-Score**: Deviasi anomali volume aliran dana asing bertanda.
3. **Sector Layer (Skor 0 - 100)**:
   - Evaluasi multi-faktor: 40% Posisi tren terhadap MA50 sektoral + 30% Relative Strength (RS) terhadap IHSG + 30% Akselerasi momentum 5-hari.
4. **Wyckoff Cycle & VCP Pattern**:
   - Deteksi fase Wyckoff: `Phase E · Markup`, `Phase D · Sign of Strength`, `Phase C · Spring ⭐`, `Phase B · Building Cause`, `Phase A · Selling Climax`, atau `UNKNOWN`.
   - Pola kontraksi volatilitas Mark Minervini (VCP Grade A+, A, B, C, atau NONE) pada saham Stage 2 uptrend.
5. **Tiered Gating System (Pencegahan False Positive)**:
   - **Hard Block**: Saham beku/suspend, volume ratio < 0.25, bid-ask spread > 3.5%, atau turnover < Rp 1,5 Miliar langsung dieliminasi.
   - **Hard Cap 45**: Saham dalam tren penurunan parah (< MA50 & < MA200) dibatasi maksimal skor 45 sehingga tidak dapat menjadi sinyal BUY.
   - **Soft Penalties**: Pengurangan skor akumulatif (-5 hingga -15, maks -30) untuk bearish divergence atau kondisi overbought RSI > 72.

### B. Lapisan AI Meta-Labeling & Dynamic Position Sizing (Half-Kelly)
1. **AI Gatekeeper (Hak Veto)**:
   - Model klasifikasi XGBoost / LightGBM terkalibrasi Platt Scaling (`CalibratedClassifierCV`) mengevaluasi 28 fitur kuantitatif point-in-time.
   - Jika probabilitas menang $P(\text{WIN}) < 50\%$, AI **memveto** sinyal tersebut dan tidak menerbitkannya ke daftar rekomendasi aktif (*APPROVED* hanya bila $\ge 50\%$).
2. **Dual Excursion Regressors (MAE & MFE)**:
   - *Expected Drawdown* (MAE): Proyeksi potensi floating loss maksimum yang mungkin terjadi sebelum menyentuh TP.
   - *Expected Runup* (MFE): Proyeksi potensi kenaikan puncak selama siklus penahanan 20 hari.
3. **Badge Alokasi Modal Half-Kelly (Capped 25%)**:
   - `🔥 AGGRESSIVE (20-25%)`: Keyakinan AI sangat tinggi dengan ekskursi MFE jauh di atas MAE. Alokasi porsi kas portofolio maksimal.
   - `⚡ OPTIMAL (10-19%)`: Setup institusional standar berimbang. Alokasi posisi utama portofolio.
   - `🛡️ LIGHT (1-9%)`: Sinyal valid dengan rasio moderat. Alokasi posisi rintisan.
   - `⛔ SKIP / NO ALLOC`: Ditolak oleh AI demi manajemen risiko portofolio.

### C. Membaca Kartu Actionable Setups (Open Positions)
Di bagian atas halaman, kartu interaktif menyajikan sinyal yang sedang aktif (*OPEN*):
- **Entry, TP, dan SL**: Level harga masuk ideal, target Take Profit, dan batas risiko Stop Loss berbasis support dan ATR.
- **Risk-to-Reward (R:R)**: Rasio keuntungan terhadap risiko dinamis (1.8x hingga 3.0x).
- **Badge AI Win Prob & Kelly**: Menampilkan probabilitas kemenangan terkalibrasi dan rekomendasi porsi modal yang aman.
- **Prediksi MAE / MFE**: Membantu trader memperkirakan titik floating loss wajar dan titik floating profit optimal.
- **Badge 5D Flow**:
  - `🟢 >= 60% 5D Flow`: Aliran dana konsisten masuk dalam 5 hari terakhir.
  - `🔴 <= 40% 5D Flow`: Dominasi aliran dana keluar/distribusi dalam 5 hari terakhir.
  - `⚪ 50% 5D Flow`: Aliran dana netral.
- **Chip Sektor**: Memberikan ringkasan status kesehatan sektor emiten (contoh: *Sektor Uptrend*, *Sektor Netral*).

### D. Filter & Navigasi Tabel Daily Market Ranking
- **Pencarian Ticker**: Ketik kode saham di kolom pencarian untuk memfilter secara instan.
- **Filter Wyckoff Phase**: Tombol filter cepat untuk menyaring saham berdasarkan fase siklus pasar (`ALL`, `A`, `B`, `C`, `D`, `E`, dan `UNKNOWN`).
- **Filter ML Label**: Menyaring berdasarkan hasil prediksi model pembelajaran mesin (`ALL`, `WIN`, `HOLD`, `LOSS`).
- **ML Win Prob**: Probabilitas kemenangan yang terkalibrasi akurat pada skala persentase `0.0% – 100.0%`.
- **Pengurutan Conviction-Based**: Sinyal diurutkan dari keyakinan probabilitas AI tertinggi ke terendah.

### E. AI Outcome Tracking & Dataset Pembelajaran ML
Sistem kini dilengkapi dengan modul evaluasi imbal hasil ke depan (*Forward Return Tracking*) untuk memvalidasi efektivitas sinyal dan membangun dataset latih Machine Learning:
- **Pelacakan Multi-Horizon**: Return harga dievaluasi pada interval $T+1, T+3, T+5, T+10$, hingga $T+20$ hari perdagangan bursa pasca-sinyal terbit.
- **Analisis Ekskursi Ekstrim 20-Hari**:
  - *Maximum Favorable Excursion* (MFE / `max_runup_20d`): Kenaikan harga tertinggi yang dicapai selama periode penahanan (mengukur potensi cuan maksimum).
  - *Maximum Adverse Excursion* (MAE / `max_drawdown_20d`): Penurunan harga terdalam yang dialami selama periode penahanan (mengukur risiko drawdown riil).
- **Snapshot Vektor Fitur Kuantitatif**: Setiap sinyal menyimpan 20+ fitur snapshot (RSI, ATR, CMF, MFI, Wyckoff phase, VCP score, flow persistence, market regime) yang dapat diekspor langsung via API (`GET /api/signal/outcomes/export`) untuk melatih model AI kustom.

---

## 7. Terminal Live System Logs & Interactive Job Runner (`/logs`)

Pusat kendali eksekusi dan pemantau log otomatisasi data pasar SMtracker yang terintegrasi langsung di InvestOwl:

### A. 9 Pekerjaan Otomasi (Job Suite)
1. **Daily Backfill**: Penarikan data transaksi bursa dan broker harian (IDX + Stockbit).
2. **DB Health Audit**: Audit integritas database, deteksi anomali data, vacuum dead tuples, dan notifikasi ke Telegram.
3. **ETL Foreign Flow**: Komputasi analitik arus dana asing (HMM regime, VAR, Network Graph).
4. **Scanner AI**: Pemindaian momentum saham Wyckoff & akumulasi Smart Money harian.
5. **Auditor Telegram**: Evaluasi sinyal aktif (`OPEN`), penutupan posisi `WIN`/`LOSS`/`EXP`, dan pengiriman digest harian ke Telegram.
6. **Full Pipeline**: Menjalankan seluruh tahapan pipeline harian pasca-market secara berurutan (`run_daily.sh`).
7. **Monthly Backfill**: Penarikan historis bulanan secara sekuensial dan aman dari limit request.
8. **Fundamentals & Governance**: Penarikan data Company Details, Direksi/Komisaris, Pemegang Saham, Rasio Keuangan (PER, PBV, ROE), dan Corporate Actions.
9. **Database Backup**: Ekspor database PostgreSQL (`pg_dump`) dan sinkronisasi ke Google Drive.

### B. Tombol Aksi & Kontrol Interaktif
- **Jalankan Sekarang**:
  - Memicu eksekusi proses di latar belakang.
  - Untuk tugas yang mendukung flag (Backfill, Fundamentals, ETL, DB Audit), sistem menampilkan **Modal Parameter Dinamis** (pemilihan Universe, Checklist Komponen Fundamental, Dropdown Tahun/Kuartal, Rentang Bulan, atau Mode Aman *Alert-Only*).
- **Hentikan**:
  - Membatalkan proses latar belakang yang sedang aktif secara aman (`SIGTERM`) tanpa perlu SSH ke server.
- **Hapus Log**:
  - Tombol tempat sampah di bilah alat terminal untuk menghapus file log yang sedang ditampilkan atau membersihkan seluruh file log pekerjaan terpilih.
- **Auto-scroll & Salin Log**:
  - Mengunci pengguliran otomatis ke baris log terbawah (*live streaming*) dan menyalin seluruh isi log ke papan klip (*clipboard*) dalam 1 klik.
- **Riwayat Log (History Picker)**:
  - Beralih antara tampilan live (*Log Terkini*) dan berkas log historis dari tanggal-tanggal sebelumnya.

---

## 8. Panel Administrasi (User Approval Gate) (`/admin`)

Khusus untuk pengguna yang email-nya terdaftar di variabel lingkungan `ADMIN_EMAILS`:
- **Tabel Daftar Pengguna**:
  - Menampilkan seluruh pengguna yang telah login ke aplikasi beserta nama, email, waktu pendaftaran, dan status akun (`Pending`, `Active`, atau `Rejected`).
- **Aksi Administrator**:
  - Klik tombol **"Approve"** berwarna hijau untuk memberikan izin akses penuh kepada pengguna yang berstatus pending.
  - Klik tombol **"Reject"** untuk menolak permohonan akses.

---

## 9. Asisten Interaktif Telegram & Mobile Command Center

Untuk kemudahan akses data kapan saja melalui perangkat ponsel, seluruh fitur Investowl terintegrasi langsung dengan asisten bot Telegram resmi (`@IDXadryanBot`):

### Fitur Interaktif:
1. **Analisis Saham & Bandarmologi Instan**:
   - Ketik `/cek BBCA` untuk melihat harga penutupan terakhir, sinyal bandar (*Big Acc*, *Neutral*, *Dist*), skor Smart Money, dan net flow asing/lokal.
2. **Top AI Signals Harian**:
   - Ketik `/signals` untuk melihat 5 saham dengan potensi momentum Wyckoff tertinggi beserta estimasi *Win Rate* dari model pembelajaran mesin.
3. **Smart Money Screener**:
   - Ketik `/screener` untuk menyaring saham-saham yang sedang diakumulasi paling masif oleh broker institusional hari ini.
4. **Whale Tracker**:
   - Ketik `/whale ZP` (atau kode broker lain seperti `AK`, `BK`, `CC`, `YP`) untuk melihat saham apa saja yang sedang diborong atau dijual oleh broker bersangkutan.
5. **Rotasi Sektor & Foreign Flow**:
   - Ketik `/sektor` untuk melihat sektor mana yang memimpin pergerakan modal dan aliran dana asing di bursa IDX hari ini.
6. **Diskusi Bahasa Alami Bebas (Powered by Google Gemini)**:
   - Anda dapat bertanya apa pun secara santai dalam bahasa Indonesia, misalnya:
     - *"Bagaimana kondisi akumulasi saham BBRI seminggu terakhir?"*
     - *"Broker asing hari ini paling banyak keluar dari sektor apa?"*
     - *"Tolong audit database bursa bulan 8 tahun 2026, apakah ada yang bolong?"*
   - Dilengkapi **memori percakapan berlanjut** (*multi-turn*) dan *auto-failover* yang tangguh.
7. **Perbaikan Mandiri Database (Bulk Auto-Fix)**:
   - Ketik `/autofix 2026-08` atau perintahkan via chat: *"tolong autofix semua data yang bolong di bulan 8 tahun 2026"*. Sistem akan secara otomatis mengumpulkan seluruh tanggal yang tertinggal dan menarik ulang datanya secara berurutan.

---

## 10. Tips & Best Practices Penggunaan

1. **Konfirmasi Sinyal Multi-Layer**:
   - Selalu cari emiten yang memiliki konvergensi positif antara **Smart Money Score > 60** dan **Technical Score > 60**. Kenaikan harga yang didukung akumulasi bandar memiliki probabilitas keberhasilan lebih tinggi dibanding breakout teknikal murni tanpa akumulasi volume.
2. **Periksa Kausalitas VAR IRF**:
   - Sebelum memutuskan *swing trade* pada saham berbasis foreign flow, buka tab *Foreign Flow Deep Dive* dan periksa grafik VAR IRF. Pastikan kurva respons bernilai positif hingga horizon $T+5$ atau $T+10$.
3. **Analisis Rotasi Konglomerasi**:
   - Gunakan halaman `/konglo` untuk mengamati ke mana likuiditas besar berotasi. Sering kali kenaikan saham dalam satu konglomerasi diawali oleh akumulasi pada emiten induk (*holding company*) sebelum merambat ke anak usaha.
4. **Hindari Jebakan Distribusi Ritel**:
   - Jika harga saham naik namun tabel broker flow didominasi oleh pembelian broker ritel (YP, PD, XC) sementara sekuritas institusi melakukan distribusi masif, waspadai potensi *distribution trap* / *bull trap*.
