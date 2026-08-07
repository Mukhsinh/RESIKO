export interface GuideSection {
    title: string;
    content: string;
}

export interface GuideItem {
    id: string;
    title: string;
    code: string;
    desc: string;
    icon: string;
    version: string;
    effectiveDate: string;
    sections: GuideSection[];
}

export const GUIDES_CONTENT: GuideItem[] = [
    {
        id: 'risiko',
        title: 'Panduan Manajemen Risiko',
        code: 'PED-MR-2026/01',
        desc: 'Pedoman Baku Pengelolaan Risiko Terintegrasi Berdasarkan ISO 31000:2018 dan Standar Akreditasi Kemenkes RI (STARKES/SNARS).',
        icon: '📘',
        version: '2.0 (Edisi Digital)',
        effectiveDate: '01 Januari 2026',
        sections: [
            {
                title: 'BAB I: PENDAHULUAN DAN LANDASAN REGULASI',
                content: `1.1 Latar Belakang
Manajemen Risiko di Fasilitas Pelayanan Kesehatan (Rumah Sakit) merupakan fondasi utama dalam menjamin keselamatan pasien (Patient Safety), keselamatan kerja pegawai (K3RS), serta keberlanjutan operasional dan finansial institusi. Rumah sakit mengelola berbagai tingkat kompleksitas medis, teknologi, dan administrasi yang berpotensi menimbulkan insiden medis maupun non-medis jika tidak dikelola secara terstruktur.

1.2 Landasan Hukum dan Regulasi Baku
Dokumen pedoman ini disusun dan diselaraskan dengan regulasi nasional dan standar akreditasi internasional, antara lain:
a. Undang-Undang Republik Indonesia Nomor 17 Tahun 2023 tentang Kesehatan.
b. Peraturan Menteri Kesehatan RI Nomor 25 Tahun 2019 tentang Penerapan Manajemen Risiko di Fasilitas Pelayanan Kesehatan.
c. Standar Akreditasi Rumah Sakit (STARKES / SNARS) Bab Peningkatan Mutu dan Keselamatan Pasien (PMKP) serta Bab Tata Kelola Rumah Sakit (TKRS).
d. Standar Internasional ISO 31000:2018 Risk Management — Guidelines.

1.3 Maksud dan Tujuan
Panduan ini dirancang sebagai petunjuk operasional baku bagi seluruh pimpinan, komite mutu, kepala bagian/bidang, dan unit kerja dalam mengoperasikan aplikasi ManRisk RS secara akurat, terintegrasi, dan terdokumentasi secara digital.`
            },
            {
                title: 'BAB II: TATA KELOLA DAN TAKSONOMI KATEGORI RISIKO',
                content: `2.1 Kerangka Kerja Tata Kelola (Three Lines Model)
Pengelolaan risiko dalam sistem ini mengadopsi prinsip Tiga Lini Pertahanan:
- Lini Pertama (Unit Kerja / Instalasi): Sebagai Pemilik Risiko (Risk Owner) yang bertanggung jawab melakukan identifikasi, penilaian awal, dan pelaksanaan tindakan mitigasi harian.
- Lini Kedua (Komite Mutu & Manajemen Risiko): Berfungsi melakukan pembinaan, pemantauan, validasi analisis risiko, dan penyusunan Profil Risiko Rumah Sakit.
- Lini Ketiga (Satuan Pengawas Internal / SPI): Melakukan pemantauan independen (assurance) atas efektivitas kerangka manajemen risiko institusi.

2.2 Taksonomi 6 Kategori Risiko Baku Rumah Sakit
Dalam aplikasi ManRisk RS, setiap risiko yang diidentifikasi wajib dikelompokkan ke dalam salah satu dari 6 kategori baku berikut:
1. Risiko Operasional: Risiko yang berkaitan dengan kegagalan proses medis/klinis, pelayanan radiologi, laboratorium, kerusakan fasilitas, gangguan SIMRS, K3RS, atau keterbatasan SDM.
2. Risiko Kepatuhan: Risiko timbulnya sanksi administrasi atau denda akibat tidak terpenuhinya regulasi Kemenkes, aturan klaim BPJS Kesehatan, atau standar izin operasional.
3. Risiko Legal: Risiko tuntutan hukum, sengketa malpraktik medis, atau sengketa perikatan kerja sama (kontrak vendor/mitra).
4. Risiko Kebijakan: Risiko dampak dari perubahan regulasi tarif nasional, kebijakan sistem JKN/BPJS, maupun perubahan Surat Keputusan Direksi.
5. Risiko Reputasi: Risiko penurunan tingkat kepercayaan masyarakat akibat penanganan keluhan pasien yang kurang responsif atau pemberitaan negatif di media.
6. Risiko Fraud: Risiko tindakan penyimpangan, penggelembungan klaim finansial, pencurian sarana, atau penyalahgunaan wewenang organisasi.`
            },
            {
                title: 'BAB III: PROSES ALUR KERJA RISIKO DALAM SISTEM',
                content: `3.1 Penetapan Konteks dan Identifikasi Risiko
Proses diawali oleh Kepala Unit Kerja dengan menetapkan sasaran operasional dan mengidentifikasi potensi risiko menggunakan formula pernyataan baku:
[Penyebab (Root Cause)] -> mengakibatkan -> [Peristiwa Risiko (Risk Event)] -> sehingga timbul -> [Dampak (Impact)].

*Contoh Kasus Konkret di Rumah Sakit*:
- Penyebab: Keterlambatan kalibrasi berkala pada unit alat CT-Scan di Radiologi.
- Peristiwa Risiko: Terjadi distorsi hasil gambar citra radiologi saat pemeriksaan pasien darurat.
- Dampak: Keterlambatan penegakan diagnosis oleh Dokter DPJP dan potensi komplain/tuntutan keluarga pasien.

3.2 Analisis dan Matriks Penilaian Risiko (5x5)
Tingkat Risiko dihitung secara otomatis oleh sistem berdasarkan rumus:
Skor Risiko = Skala Probabilitas (1-5) x Skala Dampak (1-5)

a. Skala Probabilitas (Likelihood):
1 = Sangat Jarang (< 1x dalam 1 tahun)
2 = Jarang (1-2x dalam 1 tahun)
3 = Kadang-kadang (3-6x dalam 1 tahun)
4 = Sering (7-12x dalam 1 tahun)
5 = Sangat Sering (> 12x dalam 1 tahun)

b. Skala Dampak (Severity / Impact):
1 = Insignifikan (Tidak ada cedera, kerugian finansial minimal < Rp 1 Juta)
2 = Minor (Cedera ringan/P3K, kerugian Rp 1 Juta - Rp 10 Juta)
3 = Moderat (Cedera sedang/perawatan medis, kerugian Rp 10 Juta - Rp 50 Juta)
4 = Mayor (Cedera berat/cacat permanen, kerugian Rp 50 Juta - Rp 250 Juta)
5 = Katastrofik (Kematian pasien/pegawai, kerugian > Rp 250 Juta atau izin operasional terancam)

c. Tingkat Risiko (Risk Matrix Level):
- Skor 15 - 25 (Sangat Tinggi / Ekstrem - Warna Merah): Wajib dilakukan mitigasi segera (< 24 jam) dengan pengawasan langsung Direksi.
- Skor 10 - 14 (Tinggi - Warna Oranye): Memerlukan tindak mitigasi khusus oleh Kepala Bagian/Bidang (< 7 hari).
- Skor 5 - 9 (Sedang - Warna Kuning): Dikelola dengan perbaikan SOP internal unit kerja (< 14 hari).
- Skor 1 - 4 (Rendah - Warna Hijau): Pemantauan berkala dalam prosedur rutin.

3.3 Rencana Penanganan (Mitigasi) dan Evaluasi Residual Risk
- Opsi Mitigasi: Mencegah (Avoid), Mengurangi Dampak/Probabilitas (Mitigate), Membagi Risiko (Transfer/Insurance), atau Menerima Risiko (Accept).
- Setiap mitigasi wajib menetapkan Rencana Aksi, Penanggung Jawab (PIC), Target Waktu, dan Alokasi Sumber Daya.
- Setelah penanganan berjalan, unit kerja menginput Penilaian Residual Risk (Risiko Sisa) untuk mengevaluasi penurunan skor risiko pada Dashboard dan Laporan Profil Risiko RS.`
            }
        ]
    },
    {
        id: 'strategi',
        title: 'Panduan Manajemen Strategi',
        code: 'PED-MS-2026/02',
        desc: 'Pedoman Baku Perencanaan Strategis Rumah Sakit Menggunakan Metode SWOT, Matriks TOWS, Diagram Kartesius, dan Balanced Scorecard (BSC).',
        icon: '🎯',
        version: '2.0 (Edisi Digital)',
        effectiveDate: '01 Januari 2026',
        sections: [
            {
                title: 'BAB I: LANDASAN PERENCANAAN STRATEGIS RUMAH SAKIT',
                content: `1.1 Pendahuluan Perencanaan Strategis
Manajemen Strategi adalah proses sistematis dalam merumuskan, mengimplementasikan, dan mengevaluasi keputusan lintas fungsi yang memungkinkan Rumah Sakit mencapai tujuan jangka panjang. Penyelarasan strategi bertujuan agar Visi dan Misi institusi diterjemahkan secara konsisten hingga ke tingkat operasional terdepan di setiap unit kerja.

1.2 Hierarki Perencanaan Institusi
a. Tingkat Strategis Institusi: Visi, Misi, Nilai-Nilai Tata Nilai, dan Rencana Strategis (Renstra 5 Tahunan) yang ditetapkan oleh Direksi.
b. Tingkat Taktis Direktorat/Bagian: Peta Strategis dan Rencana Kerja Tahunan (RKT) Bagian/Bidang.
c. Tingkat Operasional Unit: Cascading Indikator Kinerja Utama (IKU / KPI) dan Action Plan harian unit kerja.`
            },
            {
                title: 'BAB II: ANALISIS SITUASI (SWOT & MATRIKS TOWS)',
                content: `2.1 Analisis Lingkungan Strategis (SWOT)
Unit kerja wajib mengidentifikasi 4 elemen situasi internal dan eksternal:
- Strength (Kekuatan): Keunggulan internal (SDM spesialis, alkes canggih, lokasi strategis).
- Weakness (Kelemahan): Keterbatasan internal (area parkir terbatas, waktu tunggu obat lama).
- Opportunity (Peluang): Tren eksternal menguntungkan (kebijakan JKN baru, pertumbuhan penduduk).
- Threat (Ancaman): Tantangan eksternal (persaingan RS swasta baru, perubahan regulasi tarif).

2.2 Pemetaan Posisi Strategis pada Diagram Kartesius
Berdasarkan pembobotan total skor IFAS (Internal) dan EFAS (Eksternal), posisi unit kerja terbagi ke dalam 4 Kuadran Kartesius:
- Kuadran I (S-O / Agresif): Posisi prima. Fokus pada strategi ekspansi layanan, inovasi produk baru, dan pemanfaatan peluang maksimal.
- Kuadran II (S-T / Diversifikasi): Posisi kuat namun penuh ancaman. Fokus menggunakan kekuatan internal untuk menciptakan layanan baru / diversifikasi pasar.
- Kuadran III (W-O / Ubah Strategi - Turnaround): Peluang pasar besar namun terhambat kelemahan internal. Fokus membenahi proses bisnis internal agar mampu menangkap peluang.
- Kuadran IV (W-T / Defensif): Posisi rawan. Fokus efisiensi ketat, meminimalkan kelemahan, dan bertahan dari ancaman eksternal.

2.3 Formulasi Inisiatif Strategis TOWS (Contoh Konkret)
- Strategi SO: Mengoptimalkan SDM Sub-Spesialis (S) + Peluang Tren Penyakit Degeneratif (O) -> Pembentukan Pusat Layanan Unggulan Jantung & Pembuluh Darah (Vascular Center).
- Strategi WO: Menanggulangi waktu tunggu pendaftaran (W) + Memanfaatkan teknologi smartphone (O) -> Mengembangkan Sistem Pendaftaran Mandiri Mobile Apps & KIOSK.`
            },
            {
                title: 'BAB III: BALANCED SCORECARD (BSC) DAN CASCADING KPI',
                content: `3.1 Empat Perspektif Balanced Scorecard
ManRisk RS menerapkan pendekatan BSC untuk mengukur keberhasilan secara seimbang:
1. Perspektif Keuangan (Financial): Pertumbuhan pendapatan, efisiensi biaya operasional, pencapaian target revenue, dan kecukupan Cash Ratio.
2. Perspektif Pelanggan (Customer): Indeks Kepuasan Pasien (IKP), pencapaian SPM waktu tunggu, penanganan komplain, dan retensi pasien.
3. Perspektif Proses Bisnis Internal: Kepatuhan Clinical Pathway, angka keselamatan pasien (Zero Sentinel), efisiensi BOR/LOS, dan akreditasi.
4. Perspektif Pembelajaran & Pertumbuhan: Jam pelatihan SDM per tahun, tingkat kepuasan pegawai, kepemimpinan, dan tingkat digitalisasi sistem.

3.2 Penurunan Indikator Kinerja Utama (Cascading KPI)
Cascading dilakukan secara hierarkis:
- Level 0 (Direksi): Target Strategis Utama Institusi (contoh: Cash Ratio >= 1%, IKP >= 88%).
- Level 1 (Kepala Bagian/Bidang): Turunan indikator sasaran direksi.
- Level 2 (Kepala Unit Kerja): Operasionalisasi indikator unit.

Setiap penetapan target KPI wajib memenuhi kaidah SMART (Specific, Measurable, Achievable, Relevant, Time-bound).`
            },
            {
                title: 'BAB IV: MONITORING REALISASI DAN DASHBOARD CAPAIAN',
                content: `4.1 Pemantauan Realisasi Periodik
Realisasi KPI diinput secara berkala (Tahunan, Semesteran, Triwulanan, atau Bulanan) sesuai karakteristik indikator yang ditetapkan.

4.2 Evaluasi Capaian dan Speedometer Gauge
Tingkat capaian dihitung berdasarkan rumus: (Realisasi / Target) x 100%. Sistem memvisualisasikan status ke dalam 3 kategori:
- Status AMAN (Capaian >= 100% - Warna Hijau): Target terpenuhi atau melampaui standar.
- Status WASPADA (Capaian 70% - 99% - Warna Oranye): Capaian mendekati target, memerlukan pemantauan ketat.
- Status BAHAYA (Capaian < 70% - Warna Merah): Capaian di bawah standar, unit kerja wajib membuat Rencana Tindakan Korektif (Corrective Action Plan).`
            }
        ]
    }
];

export const TOR_CONTENT = {
    title: 'Term of Reference (TOR): Pelatihan ManRisk RS',
    objective: 'Meningkatkan kapabilitas manajerial dan pengelolaan risiko bagi pimpinan serta staf rumah sakit melalui implementasi sistem informasi digital terintegrasi.',
    outcomes: [
        'Peserta memahami konsep ISO 31000:2018 dan BSC dalam konteks rumah sakit.',
        'Peserta mampu mengoperasikan seluruh modul dalam sistem ManRisk RS.',
        'Peserta mampu melakukan analisis SWOT/TOWS dan cascading IKU secara mandiri.',
        'Tersedianya Database Profil Risiko digital yang valid di setiap unit kerja.'
    ],
    schedule: [
        {
            day: 'Hari ke-1: Fondasi & Administrasi Sistem',
            sessions: [
                { time: '08:00 - 09:30', activity: 'Pembukaan & Pre-Test Materi Manajemen Risiko Rumah Sakit' },
                { time: '09:45 - 12:00', activity: 'Pengenalan Sistem & Konfigurasi Master Data (Unit, Tahun, User)' },
                { time: '13:00 - 15:30', activity: 'Workshop: Pengisian Visi, Misi, dan Nilai Institusi' }
            ]
        },
        {
            day: 'Hari ke-2: Perencanaan Strategis (BSC & SWOT)',
            sessions: [
                { time: '08:00 - 10:30', activity: 'Analisis Situasi: Identifikasi Kekuatan, Kelemahan, Peluang & Ancaman' },
                { time: '10:45 - 12:00', activity: 'Matriks TOWS & Pemetaan Strategi menggunakan Diagram Kartesius' },
                { time: '13:00 - 15:30', activity: 'Cascading KPI: Menurunkan Sasaran Strategis ke Level Unit' }
            ]
        },
        {
            day: 'Hari ke-3: Risk Identification & AI Empowerment',
            sessions: [
                { time: '08:00 - 10:30', activity: 'Digital Risk Register: Input Identifikasi hingga Penanganan Risiko' },
                { time: '10:45 - 12:00', activity: 'Pemanfaatan AI untuk Analisis Risiko yang Akurat dan Cepat' },
                { time: '13:00 - 15:00', activity: 'Final Review: Monitoring KPI & Cetak Laporan Komprehensif' },
                { time: '15:15 - 16:30', activity: 'Post-Test & Penutupan' }
            ]
        }
    ],
    location: 'Aula Utama / Ruang Pertemuan RSUD Bendan',
    contact: 'Bidang Perencanaan dan Evaluasi (Ext. 123)'
};
