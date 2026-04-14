const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CURRENT_YEAR = new Date().getFullYear();

const mockUnits = [
    { nama_unit: 'Unit Pelayanan' },
    { nama_unit: 'Unit Keperawatan' },
    { nama_unit: 'Unit Tata Usaha' },
    { nama_unit: 'Unit Penunjang' },
    { nama_unit: 'Unit Farmasi' }
];

async function seed() {
    console.log('Fetching Units...');
    let { data: finalUnits } = await supabase.from('unit_kerja').select('*');

    if (!finalUnits || finalUnits.length < 5) {
        console.log('Inserting missing units...');
        const existingNames = finalUnits ? finalUnits.map(u => u.nama_unit) : [];
        const toInsert = mockUnits.filter(u => !existingNames.includes(u.nama_unit));
        if (toInsert.length > 0) {
            await supabase.from('unit_kerja').insert(toInsert);
        }
        const refetch = await supabase.from('unit_kerja').select('*');
        finalUnits = refetch.data;
    }

    if (!finalUnits) {
        console.error("Failed to fetch units");
        return;
    }

    console.log('Units loaded!', finalUnits.length);

    const u1 = finalUnits.find(u => u.nama_unit === 'Unit Pelayanan')?.id || finalUnits[0].id;
    const u2 = finalUnits.find(u => u.nama_unit === 'Unit Keperawatan')?.id || finalUnits[0].id;
    const u3 = finalUnits.find(u => u.nama_unit === 'Unit Tata Usaha')?.id || finalUnits[0].id;
    const u4 = finalUnits.find(u => u.nama_unit === 'Unit Penunjang')?.id || finalUnits[0].id;
    const u5 = finalUnits.find(u => u.nama_unit === 'Unit Farmasi')?.id || finalUnits[0].id;

    const mockRisiko = [
        { unit_kerja_id: u1, tahun: CURRENT_YEAR, status: 'Open', identifikasi_risiko: 'Keterlambatan penanganan pasien darurat', probabilitas: 4, dampak: 5, skor_risiko: 20, mitigasi: 'Penambahan perawat triage' },
        { unit_kerja_id: u2, tahun: CURRENT_YEAR, status: 'Mitigasi Berjalan', identifikasi_risiko: 'Risiko infeksi nosokomial', probabilitas: 3, dampak: 4, skor_risiko: 12, mitigasi: 'Penerapan standar sterilisasi alat harian ketat' },
        { unit_kerja_id: u3, tahun: CURRENT_YEAR, status: 'Monitoring', identifikasi_risiko: 'Kehilangan dokumen rekam medis', probabilitas: 2, dampak: 3, skor_risiko: 6, mitigasi: 'Digitalisasi rekam medis secara bertahap' },
        { unit_kerja_id: u4, tahun: CURRENT_YEAR, status: 'Closed', identifikasi_risiko: 'Kerusakan mesin radiologi CT-Scan', probabilitas: 2, dampak: 5, skor_risiko: 10, mitigasi: 'Kalibrasi komprehensif' },
        { unit_kerja_id: u5, tahun: CURRENT_YEAR, status: 'Open', identifikasi_risiko: 'Kekosongan stok obat esensial antibiotik', probabilitas: 3, dampak: 4, skor_risiko: 12, mitigasi: 'Pemesanan ulang otomatis saat stok mencapai batas minimal' }
    ];

    console.log('Seeding Risiko...');
    const { data: existingRisiko } = await supabase.from('manajemen_risiko').select('identifikasi_risiko');
    const existingRisikoNames = existingRisiko ? existingRisiko.map(r => r.identifikasi_risiko) : [];
    const risikoToInsert = mockRisiko.filter(r => !existingRisikoNames.includes(r.identifikasi_risiko));
    if (risikoToInsert.length > 0) {
        const { error: errRisiko } = await supabase.from('manajemen_risiko').insert(risikoToInsert);
        if (errRisiko) console.error('Error inserting Risiko:', errRisiko);
        else console.log('Risiko seeded!');
    }

    // Tow, Swot, Renstra, dll ? "isi aplikasi dari awal sampai akhir"
    // To ensure charts and other pages have data:

    const mockStrategi = [
        { unit_kerja_id: u1, tahun: CURRENT_YEAR, sasaran_strategis: 'Meningkatkan kepuasan pasien', kpi: 'Tingkat kepuasan pasien', target: '90%', realisasi: '85%' },
        { unit_kerja_id: u2, tahun: CURRENT_YEAR, sasaran_strategis: 'Meningkatkan standar keselamatan pasien', kpi: 'Jumlah insiden', target: '0 Insiden', realisasi: '2 Insiden' },
        { unit_kerja_id: u3, tahun: CURRENT_YEAR, sasaran_strategis: 'Efisiesi pengelolaan administrasi', kpi: 'Klaim asuransi terbayar', target: '95%', realisasi: '92%' },
        { unit_kerja_id: u4, tahun: CURRENT_YEAR, sasaran_strategis: 'Keandalan alat medis', kpi: 'Uptime operasional', target: '99%', realisasi: '98.5%' },
        { unit_kerja_id: u5, tahun: CURRENT_YEAR, sasaran_strategis: 'Ketersediaan obat tepat mutu', kpi: 'Zero stock out', target: '100%', realisasi: '100%' }
    ];

    console.log('Seeding Strategi...');
    const { data: existingStrategi } = await supabase.from('manajemen_strategi').select('sasaran_strategis');
    const existingStrategiNames = existingStrategi ? existingStrategi.map(s => s.sasaran_strategis) : [];
    const strategiToInsert = mockStrategi.filter(s => !existingStrategiNames.includes(s.sasaran_strategis));
    if (strategiToInsert.length > 0) {
        const { error: errStrategi } = await supabase.from('manajemen_strategi').insert(strategiToInsert);
        if (errStrategi) console.error('Error inserting Strategi:', errStrategi);
        else console.log('Strategi seeded!');
    }
}

seed();
