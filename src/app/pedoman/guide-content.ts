export const GUIDES_CONTENT = [
    {
        id: 'risiko',
        title: 'Panduan Manajemen Risiko',
        desc: 'Standar ISO 31000:2018 & SNARS untuk pengelolaan risiko rumah sakit.',
        icon: '📘',
        sections: [
            {
                title: 'I. Pendahuluan',
                content: `Manajemen risiko di rumah sakit merupakan komponen krusial dalam menjamin keselamatan pasien (patient safety) dan keberlanjutan operasional. Panduan ini disusun berdasarkan standar internasional ISO 31000:2018 dan diselaraskan dengan standar akreditasi rumah sakit (SNARS).`
            },
            {
                title: 'II. Kerangka Kerja Manajemen Risiko',
                content: `Manajemen risiko tidak berdiri sendiri, melainkan terintegrasi dalam tata kelola institusi. Elemen utama meliputi:\n- Kepemimpinan dan Komitmen\n- Integrasi dalam Proses Bisnis\n- Desain Arsitektur Manajemen Risiko\n- Implementasi yang Terukur\n- Evaluasi Berkelanjutan`
            },
            {
                title: 'III. Proses Manajemen Risiko (ISO 31000)',
                content: `1. **Penetapan Ruang Lingkup, Konteks, dan Kriteria**: Mendefinisikan parameter eksternal dan internal yang menjadi batasan pengelolaan.\n2. **Identifikasi Risiko**: Menemukan, mengenali, dan mendeskripsikan risiko yang dapat mencegah pencapaian tujuan.\n3. **Analisis Risiko**: Memahami sifat risiko dan menentukan tingkat risiko (Likelihood x Impact).\n4. **Evaluasi Risiko**: Membandingkan hasil analisis dengan kriteria risiko untuk menentukan kebutuhan penanganan.\n5. **Penanganan Risiko (Mitigasi)**: Memilih dan mengimplementasikan opsi untuk memodifikasi risiko.`
            },
            {
                title: 'IV. Integrasi SNARS',
                content: `Sistem ManRisk RS memfasilitasi pemenuhan standar PMKP (Peningkatan Mutu dan Keselamatan Pasien) dengan menyediakan database risiko yang terstruktur, memudahkan audit, dan pelaporan insiden secara preventif.`
            }
        ]
    },
    {
        id: 'strategi',
        title: 'Panduan Manajemen Strategi',
        desc: 'Metodologi penyusunan Renstra dan cascading KPI berbasis BSC.',
        icon: '🎯',
        sections: [
            {
                title: 'I. Konsep Balanced Scorecard (BSC)',
                content: `Sistem ini menggunakan pendekatan BSC untuk menerjemahkan visi dan misi ke dalam tindakan strategis melalui empat perspektif:\n1. **Perspektif Keuangan**: Bagaimana kita dilihat oleh penyandang dana?\n2. **Perspektif Pelanggan**: Bagaimana pasien melihat kita?\n3. **Perspektif Proses Internal**: Di mana kita harus unggul?\n4. **Perspektif Pembelajaran & Pertumbuhan**: Bagaimana kita terus berkembang?`
            },
            {
                title: 'II. Analisis Situasi (SWOT & TOWS)',
                content: `Sebelum menyusun strategi, unit kerja wajib melakukan:\n- **SWOT**: Identifikasi Strength, Weakness, Opportunity, dan Threat.\n- **TOWS**: Membuat strategi SO, WO, ST, dan WT berdasarkan pemetaan Kartesius.\n- **Matriks Kartesius**: Memvisualisasikan posisi strategis unit (Agresif, Diversifikasi, Ubah Strategi, atau Defensif).`
            },
            {
                title: 'III. Cascading KPI',
                content: `Proses penurunan Indikator Kinerja Utama (IKU) dari level Direktur (Level 0) ke Kepala Bagian (Level 1) hingga ke tingkat unit kerja. Hal ini memastikan keselarasan (alignment) seluruh komponen rumah sakit menuju satu tujuan yang sama.`
            }
        ]
    },
    {
        id: 'template',
        title: 'Template Identifikasi Risiko',
        desc: 'Template standar pengisian form identifikasi dan penilaian risiko.',
        icon: '📋',
        sections: [
            {
                title: 'I. Kamus Risiko',
                content: `Dalam mengisi form identifikasi, gunakan terminologi yang baku:\n- **Kategori Risiko**: Strategis, Operasional, Finansial, Kepatuhan, Reputasi.\n- **Penyebab**: Akar masalah (Root Cause).\n- **Dampak**: Kerugian yang timbul (Cedera, Finansial, Hukum).`
            },
            {
                title: 'II. Matriks Penilaian Risiko (5x5)',
                content: `Tingkat Risiko dihitung berdasarkan:\n- **Skala Probabilitas (1-5)**: Dari 'Sangat Jarang' hingga 'Sangat Sering'.\n- **Skala Dampak (1-5)**: Dari 'Minimal/Insignifikan' hingga 'Katastrofik'.\n- **Skor Risiko**: Hasil perkalian keduanya yang menentukan warna (Hijau, Kuning, Oranye, Merah).`
            }
        ]
    },
    {
        id: 'excel',
        title: 'Panduan Import Data (Excel)',
        desc: 'Cara menggunakan fitur unduh template dan import data massal.',
        icon: '📊',
        sections: [
            {
                title: 'I. Persiapan File',
                content: `1. Gunakan tombol **Unduh Template** di setiap halaman Master Data.\n2. Pastikan tidak mengubah struktur header atau urutan kolom.\n3. Simpan file dalam format .xlsx atau .xls.`
            },
            {
                title: 'II. Validasi Data',
                content: `- **Tahun**: Harus angka unik (contoh: 2026).\n- **Email**: Harus valid dan belum pernah terdaftar.\n- **Role**: Pilih antara 'superadmin' atau 'user_unit'.\n- **Unit ID**: Wajib diisi untuk user dengan role 'user_unit'.`
            },
            {
                title: 'III. Troubleshooting',
                content: `Jika import gagal:\n- Periksa apakah ada baris kosong di tengah data.\n- Pastikan koneksi internet stabil.\n- Cek apakah password pengguna minimal 8 karakter.`
            }
        ]
    },
    {
        id: 'ai',
        title: 'Panduan Pengaturan AI',
        desc: 'Cara mengkonfigurasi model AI dan menggunakan fitur bantuan AI.',
        icon: '🤖',
        sections: [
            {
                title: 'I. Konfigurasi API',
                content: `Sistem ini menggunakan Google Gemini AI. Administrative user dapat mengatur API key melalui halaman Pengaturan AI. Pastikan kuota API masih tersedia untuk fitur bantuan analisis.`
            },
            {
                title: 'II. Fitur Bantuan AI',
                content: `- **Smart Analysis**: Memberikan saran kategori dan level risiko secara otomatis.\n- **Strategy Recommender**: Memberikan opsi strategi TOWS berdasarkan data SWOT yang diinput.\n- **KPI Generator**: Membantu merumuskan indikator keberhasilan yang SMART (Specific, Measurable, Achievable, Relevant, Time-bound).`
            }
        ]
    },
    {
        id: 'manual',
        title: 'Manual Pengguna Lengkap',
        desc: 'Panduan lengkap penggunaan aplikasi ManRisk RS dari awal hingga akhir.',
        icon: '📖',
        sections: [
            {
                title: 'I. Akses Sistem',
                content: `Login menggunakan email dan password yang telah didaftarkan oleh administrator. Gunakan dashboard untuk melihat ringkasan profil risiko unit Anda secara real-time.`
            },
            {
                title: 'II. Workflow Utama',
                content: `1. **Master Data**: Setup unit, tahun, dan pengguna.\n2. **Manajemen Strategi**: Pengisian Visi Misi -> SWOT -> TOWS -> RKT -> Monitoring.\n3. **Manajemen Risiko**: Identifikasi -> Analisis -> Evaluasi -> Penanganan.\n4. **Laporan**: Unduh PDF Profil Risiko dan Evaluasi IKT.`
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
