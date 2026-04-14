import { ManajemenRisiko, UnitKerja, ManajemenStrategi } from './supabase';

const CURRENT_YEAR = new Date().getFullYear();

export const mockUnits: UnitKerja[] = [
    { id: 'u1', nama_unit: 'Unit Pelayanan', created_at: new Date().toISOString() },
    { id: 'u2', nama_unit: 'Unit Keperawatan', created_at: new Date().toISOString() },
    { id: 'u3', nama_unit: 'Unit Tata Usaha', created_at: new Date().toISOString() },
    { id: 'u4', nama_unit: 'Unit Penunjang', created_at: new Date().toISOString() },
    { id: 'u5', nama_unit: 'Unit Farmasi', created_at: new Date().toISOString() },
];

export const mockManajemenRisiko: ManajemenRisiko[] = [
    {
        id: 'r1', unit_kerja_id: 'u1', tahun: CURRENT_YEAR, status: 'Open',
        identifikasi_risiko: 'Keterlambatan penanganan pasien darurat IGD di jam sibuk',
        probabilitas: 4, dampak: 5, skor_risiko: 20, mitigasi: 'Penambahan perawat triage',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[0]
    },
    {
        id: 'r2', unit_kerja_id: 'u2', tahun: CURRENT_YEAR, status: 'Mitigasi Berjalan',
        identifikasi_risiko: 'Risiko infeksi nosokomial di ruang rawat inap utama',
        probabilitas: 3, dampak: 4, skor_risiko: 12, mitigasi: 'Penerapan standar sterilisasi alat harian ketat',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[1]
    },
    {
        id: 'r3', unit_kerja_id: 'u3', tahun: CURRENT_YEAR, status: 'Monitoring',
        identifikasi_risiko: 'Kehilangan dokumen rekam medis pasien rawat jalan',
        probabilitas: 2, dampak: 3, skor_risiko: 6, mitigasi: 'Digitalisasi rekam medis secara bertahap',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[2]
    },
    {
        id: 'r4', unit_kerja_id: 'u4', tahun: CURRENT_YEAR, status: 'Closed',
        identifikasi_risiko: 'Kerusakan pada mesin radiologi CT-Scan saat jam operasional',
        probabilitas: 2, dampak: 5, skor_risiko: 10, mitigasi: 'Kalibrasi dan maintenance berkala setiap 3 bulan',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[3]
    },
    {
        id: 'r5', unit_kerja_id: 'u5', tahun: CURRENT_YEAR, status: 'Open',
        identifikasi_risiko: 'Kekosongan stok obat esensial antibiotik',
        probabilitas: 3, dampak: 4, skor_risiko: 12, mitigasi: 'Pemesanan ulang otomatis saat stok mencapai batas minimal',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[4]
    },
    {
        id: 'r6', unit_kerja_id: 'u1', tahun: CURRENT_YEAR - 1, status: 'Closed',
        identifikasi_risiko: 'Komplain panjang antrian loket pendaftaran',
        probabilitas: 4, dampak: 3, skor_risiko: 12, mitigasi: 'Penambahan mesin antrian kios K',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[0]
    },
    {
        id: 'r7', unit_kerja_id: 'u2', tahun: CURRENT_YEAR, status: 'Open',
        identifikasi_risiko: 'Kelelahan perawat pada shift malam akibat kurang personal',
        probabilitas: 5, dampak: 4, skor_risiko: 20, mitigasi: 'Evaluasi jadwal shift dan penambahan staf perawat',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[1]
    },
    {
        id: 'r8', unit_kerja_id: 'u5', tahun: CURRENT_YEAR, status: 'Monitoring',
        identifikasi_risiko: 'Risiko obat kedaluwarsa di gudang farmasi',
        probabilitas: 2, dampak: 3, skor_risiko: 6, mitigasi: 'Penerapan sistem First Expired First Out (FEFO)',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[4]
    }
];

export const mockStrategi: ManajemenStrategi[] = [
    {
        id: 's1', unit_kerja_id: 'u1', tahun: CURRENT_YEAR,
        sasaran_strategis: 'Meningkatkan kepuasan pasien terhadap layanan gawat darurat',
        kpi: 'Tingkat kepuasan pasien survei internal', target: '90%', realisasi: '85%',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[0]
    },
    {
        id: 's2', unit_kerja_id: 'u2', tahun: CURRENT_YEAR,
        sasaran_strategis: 'Meningkatkan standar keselamatan pasien (Patient Safety)',
        kpi: 'Jumlah insiden keselamatan pasien', target: '0 Insiden', realisasi: '2 Insiden',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[1]
    },
    {
        id: 's3', unit_kerja_id: 'u3', tahun: CURRENT_YEAR,
        sasaran_strategis: 'Efisiesi pengelolaan administrasi dan keuangan',
        kpi: 'Persentase klaim asuransi terbayar tepat waktu', target: '95%', realisasi: '92%',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[2]
    },
    {
        id: 's4', unit_kerja_id: 'u4', tahun: CURRENT_YEAR,
        sasaran_strategis: 'Keandalan alat medis pendukung tepat waktu',
        kpi: 'Uptime operasional mesin prioritas tinggi', target: '99%', realisasi: '98.5%',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[3]
    },
    {
        id: 's5', unit_kerja_id: 'u5', tahun: CURRENT_YEAR,
        sasaran_strategis: 'Ketersediaan obat tepat mutu dan waktu',
        kpi: 'Zero stock out pada obat life-saving', target: '100%', realisasi: '100%',
        created_at: new Date().toISOString(), unit_kerja: mockUnits[4]
    }
];

export const mockVisiMisi = mockUnits.map(u => ({ id: u.id, unit_kerja_id: u.id, tahun: CURRENT_YEAR, statment_visi: 'Menjadi layanan kesehatan terbaik', statment_misi: 'Memberikan pelayanan prima dengan teknologi terkini' }));
export const mockSwot = mockUnits.map(u => ({ id: u.id, unit_kerja_id: u.id, tahun: CURRENT_YEAR, kekuatan: ['SDM Kompeten'], kelemahan: ['Infrastruktur tua'], peluang: ['Teknologi baru'], ancaman: ['Kompetitor lokal'] }));
export const mockTows = mockUnits.map(u => ({ id: u.id, unit_kerja_id: u.id, tahun: CURRENT_YEAR, so: ['Ekspansi layanan'], wo: ['Upgrade fasilitas'], st: ['Retensi nakes'], wt: ['Efisiensi ops'] }));
export const mockRkt = mockStrategi.map((s, i) => ({ id: s.id, unit_kerja_id: s.unit_kerja_id, tahun: s.tahun, program_kerja: 'Program Kerja ' + (i + 1), anggaran: 100000000, target_waktu: CURRENT_YEAR + '-12-31', unit_kerja: mockUnits.find(u => u.id === s.unit_kerja_id) }));
export const mockRenstra = mockStrategi.map((s, i) => ({
    id: s.id,
    unit_kerja_id: s.unit_kerja_id,
    periode_awal: CURRENT_YEAR,
    periode_akhir: CURRENT_YEAR + 4,
    tujuan_strategis: s.sasaran_strategis,
    sasaran: s.kpi,
    program: 'Program Utama ' + (i + 1) + ': ' + s.sasaran_strategis.slice(0, 40),
    anggaran_estimasi: 'Rp ' + ((i + 1) * 250_000_000).toLocaleString('id-ID'),
    penanggung_jawab: ['Direktur RS', 'Ka. Bid. Pelayanan', 'Ka. Bid. SDM', 'Ka. Bid. Penunjang', 'Ka. Instalasi Farmasi'][i % 5],
    created_at: new Date().toISOString(),
    unit_kerja: mockUnits.find(u => u.id === s.unit_kerja_id)
}));
export const mockCascading = mockStrategi.map((s, i) => ({ id: s.id, unit_kerja_id: s.unit_kerja_id, tahun: s.tahun, perspektif: ['Financial', 'Customer', 'Internal Process', 'Learning & Growth'][i % 4], sasaran_strategis: s.sasaran_strategis, kpi: s.kpi, target: s.target, bobot: 20, inisiatif: 'Inisiatif Strategis', unit_kerja: mockUnits.find(u => u.id === s.unit_kerja_id) }));
export const mockPenangananRisiko = mockManajemenRisiko.map((r, i) => ({
    id: r.id, manajemen_risiko_id: r.id, unit_kerja_id: r.unit_kerja_id, tahun: r.tahun,
    jenis_penanganan: 'Mitigasi', rencana_aksi: r.mitigasi || 'Melakukan pengecekan rutin', penanggung_jawab: 'Kepala Unit', target_selesai: `${CURRENT_YEAR}-12-31`, status: ['Selesai', 'Berjalan', 'Terlambat', 'Belum Mulai'][i % 4], progres: parseFloat(((100 - i * 25) % 100).toFixed(2)) || 100,
    risiko: { identifikasi_risiko: r.identifikasi_risiko, skor_risiko: r.skor_risiko }, unit_kerja: mockUnits.find(u => u.id === r.unit_kerja_id)
}));
