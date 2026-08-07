import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

let _supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
    if (!_supabaseAdminInstance) {
        let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        let key = process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;

        if (!url || !key) {
            try {
                const fs = require('fs');
                const path = require('path');
                const envPath = path.resolve(process.cwd(), '.env.local');
                if (fs.existsSync(envPath)) {
                    const envData = fs.readFileSync(envPath, 'utf8');
                    envData.split('\n').forEach((line: string) => {
                        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
                        if (match) {
                            const k = match[1];
                            let val = match[2].trim();
                            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
                            if (k === 'NEXT_PUBLIC_SUPABASE_URL') url = val;
                            if (k === 'NEXT_PUBLIC_SERVICE_ROLE_KEY') key = val;
                        }
                    });
                }
            } catch (e) {
                console.error('Failed to load env variables manually:', e);
            }
        }

        if (!url || !key) {
            throw new Error('Supabase URL atau Service Role Key belum dikonfigurasi.');
        }
        _supabaseAdminInstance = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }
    return _supabaseAdminInstance;
}

const supabaseAdmin = new Proxy({} as any, {
    get(target, prop, receiver) {
        const instance = getSupabaseAdmin();
        const value = Reflect.get(instance, prop, receiver);
        if (typeof value === 'function') {
            return value.bind(instance);
        }
        return value;
    }
}) as any;

// Helper function to call OpenAI GPT-4o
async function callOpenAI(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
    if (!apiKey) throw new Error('API Key OpenAI tidak tersedia.');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenAI API Error (Status ${response.status}): ${errBody}`);
    }

    const resJson = await response.json();
    const result = resJson.choices?.[0]?.message?.content;
    if (!result) throw new Error('OpenAI tidak mengembalikan konten teks.');
    return result;
}

// Helper function to call Gemini (gemini-flash-latest) via REST API v1beta
async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
    if (!apiKey) throw new Error('API Key Gemini tidak tersedia.');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        { text: `${systemPrompt}\n\nPermintaan pengguna:\n${userPrompt}` }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 1000
            }
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API Error (Status ${response.status}): ${errBody}`);
    }

    const resJson = await response.json();
    const result = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!result) throw new Error('Gemini tidak mengembalikan konten teks.');
    return result;
}

// Helper function to call OpenRouter (GPT-4o)
async function callOpenRouter(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
    if (!apiKey) throw new Error('API Key OpenRouter tidak tersedia.');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Manrisk RS',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'openai/gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenRouter API Error (Status ${response.status}): ${errBody}`);
    }

    const resJson = await response.json();
    const result = resJson.choices?.[0]?.message?.content;
    if (!result) throw new Error('OpenRouter tidak mengembalikan konten teks.');
    return result;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { prompt: userPrompt, label, mode, contextData } = body;

        // 1. Fetch AI configurations from Supabase with fallback to process.env
        let modelTerpilih = 'auto';
        let openaiKey = process.env.OPENAI_API_KEY || '';
        let geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
        let openrouterKey = process.env.OPENROUTER_API_KEY || '';
        let baseSystemPrompt = 'Kamu adalah asisten profesional manajemen risiko dan manajemen strategi rumah sakit (ISO 31000 & STARKES Kemenkes RI).';
        let isAiActive = true;
        let extra: Record<string, any> = {};

        try {
            const { data: aiConfig, error: fetchErr } = await supabaseAdmin
                .from('pengaturan_ai')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!fetchErr && aiConfig) {
                if (!aiConfig.aktif) {
                    isAiActive = false;
                }
                modelTerpilih = aiConfig.model_ai_terpilih || modelTerpilih;
                extra = aiConfig.konfigurasi_tambahan || {};
                if (extra.openai_key) openaiKey = extra.openai_key;
                if (extra.gemini_key) geminiKey = extra.gemini_key;
                if (extra.openrouter_key) openrouterKey = extra.openrouter_key;
                if (extra.system_prompt) baseSystemPrompt = extra.system_prompt;
            }
        } catch (dbErr) {
            console.warn('DB AI Config fetch error, falling back to env vars:', dbErr);
        }

        if (!isAiActive) {
            return NextResponse.json({ error: 'Fitur bantuan AI dinonaktifkan oleh administrator.' }, { status: 400 });
        }

        // If no keys are provided from DB or Env, return helpful error
        if (!openaiKey && !geminiKey && !openrouterKey) {
            return NextResponse.json({
                error: 'API Key AI (Gemini / OpenAI / OpenRouter) belum terkonfigurasi pada sistem maupun environment server.'
            }, { status: 400 });
        }

        // Auto-select provider if default is auto
        if (modelTerpilih === 'auto' || !modelTerpilih) {
            if (geminiKey) modelTerpilih = 'gemini';
            else if (openaiKey) modelTerpilih = 'openai';
            else if (openrouterKey) modelTerpilih = 'openrouter';
        }

        // Handle Simultaneous Multi-Field Risk Generation Mode
        if (mode === 'simultaneous_risk') {
            const systemPrompt = baseSystemPrompt + `
Tugas Anda adalah menganalisis input risiko rumah sakit dan menghasilkan rekomendasi draft simultan untuk 4 bidang:
1. Deskripsi Risiko (Formula: [Kejadian Risiko] akibat [Penyebab utama] sehingga berpotensi [Dampak klinis/operasional RS])
2. Akar Penyebab (Root Cause Analysis mendalam berbasis 5-Why/Fishbone)
3. Penyebab Risiko (Faktor-faktor penyebab teknis, SDM, atau sarana)
4. Dampak Risiko (Dampak langsung pada keselamatan pasien, mutu klinis, finansial, atau reputasi RS)

PERATURAN OUTPUT (SANGAT KETAT):
- Anda HARUS mengembalikan HANYA sebuah objek JSON valid (tanpa tag markdown json) dengan struktur berikut:
{
  "identifikasi_deskripsi": "...",
  "identifikasi_akar_penyebab": "...",
  "penyebab_risiko": "...",
  "dampak_risiko": "..."
}`;

            const userPromptText = `
Konteks Identifikasi Risiko Rumah Sakit:
- Nama Risiko: ${contextData?.nama_risiko || userPrompt || 'Risiko Pelayanan Klinis'}
- Unit Kerja: ${contextData?.unit_kerja || 'Seluruh Unit RS'}
- Kategori Risiko: ${contextData?.kategori_risiko || 'Risiko Operasional'}
- Sasaran Strategis: ${contextData?.sasaran || 'Peningkatan Mutu & Keselamatan Pasien'}
- Jenis Risiko: ${contextData?.jenis_risiko || 'Threat'}

Mohon hasilkan analisis draft 4 bidang tersebut secara simultan, spesifik, akurat, tanpa halusinasi, dan relevan dengan rumah sakit.
`;

            let jsonText = '';
            let modelUsed = '';

            if (modelTerpilih === 'gemini' || (geminiKey && !jsonText)) {
                try {
                    jsonText = await callGemini(geminiKey, systemPrompt, userPromptText);
                    modelUsed = 'Google Gemini (Flash)';
                } catch (e) {
                    if (openaiKey) {
                        jsonText = await callOpenAI(openaiKey, systemPrompt, userPromptText);
                        modelUsed = 'OpenAI (GPT-4o)';
                    }
                }
            } else if (modelTerpilih === 'openai' || (openaiKey && !jsonText)) {
                try {
                    jsonText = await callOpenAI(openaiKey, systemPrompt, userPromptText);
                    modelUsed = 'OpenAI (GPT-4o)';
                } catch (e) {
                    if (geminiKey) {
                        jsonText = await callGemini(geminiKey, systemPrompt, userPromptText);
                        modelUsed = 'Google Gemini (Flash)';
                    }
                }
            } else if (openrouterKey) {
                jsonText = await callOpenRouter(openrouterKey, systemPrompt, userPromptText);
                modelUsed = 'OpenRouter (GPT-4o)';
            }

            let cleanedJson = jsonText.trim();
            if (cleanedJson.startsWith('```json')) cleanedJson = cleanedJson.replace(/^```json/, '').replace(/```$/, '').trim();
            if (cleanedJson.startsWith('```')) cleanedJson = cleanedJson.replace(/^```/, '').replace(/```$/, '').trim();

            let batchResult = null;
            try {
                batchResult = JSON.parse(cleanedJson);
            } catch (err) {
                console.error('Failed to parse AI JSON batch result:', cleanedJson);
                batchResult = {
                    identifikasi_deskripsi: cleanedJson,
                    identifikasi_akar_penyebab: 'Akar penyebab perlu ditinjau ulang.',
                    penyebab_risiko: 'Penyebab risiko perlu ditinjau ulang.',
                    dampak_risiko: 'Dampak risiko perlu ditinjau ulang.'
                };
            }

            return NextResponse.json({
                success: true,
                batchResult,
                model_used: modelUsed
            });
        }

        // 2. Build input-specific instructions to prevent generic/hallucinatory suggestions
        const targetLabel = (label || '').toLowerCase();
        let inputSpecificInstruction = '';

        if (targetLabel.includes('visi')) {
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: VISI ORGANISASI]
- Input yang diisi adalah "VISI ORGANISASI / RUMAH SAKIT" (Cita-cita jangka panjang organisasi secara keseluruhan).
- Anda HARUS mengabaikan batasan jangka pendek (seperti batasan biaya rendah, durasi kerja < 3 bulan, ataupun larangan rekrutmen staf) dan unit kerja mikro (seperti IGD) karena Visi bersifat jangka panjang dan mencakup seluruh rumah sakit.
- Format Output: Tuliskan tepat 1 kalimat pernyataan visi yang megah, visioner, berwawasan mutu pelayanan, serta keselamatan pasien.
- JANGAN berikan daftar butir (bullet points), JANGAN berikan tindakan operasional, sasaran strategis unit, misi, atau indikator KPI.
`;
        } else if (targetLabel.includes('misi')) {
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: MISI ORGANISASI]
- Input yang diisi adalah "MISI ORGANISASI / RUMAH SAKIT" (Upaya makro untuk mewujudkan visi).
- Tuliskan 3 sampai 4 poin pernyataan misi organisasi yang diawali dengan kata kerja tindakan aktif (misalnya: Menyelenggarakan..., Meningkatkan..., Mengoptimalkan...).
- Fokus pada mutu layanan kesehatan, keselamatan pasien, efisiensi operasional, dan pengembangan SDM rumah sakit secara keseluruhan.
- JANGAN menyebutkan KPI spesifik atau pembatasan anggaran mikro.
`;
        } else if (targetLabel.includes('rumusan strategi') || targetLabel.includes('tows')) {
            // TOWS Strategy Formulations (labels like "Rumusan Strategi TOWS SO", "Rumusan Strategi TOWS WT")
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: RUMUSAN STRATEGI TOWS]
- Input yang diisi adalah RUMUSAN STRATEGI TOWS untuk kuadran "${label}".
- Ini adalah strategi yang memanfaatkan kombinasi faktor-faktor SWOT (contoh: SO = memanfaatkan Kekuatan untuk meraih Peluang, WT = meminimalkan Kelemahan dan menghindari Ancaman).
- Tuliskan 1-2 rumusan strategi yang konkret, diawali verba tindakan aktif, dan relevan dengan konteks rumah sakit.
- JANGAN membuat Visi, Misi, KPI, atau Identifikasi Risiko di sini.
`;
        } else if (targetLabel.includes('swot') || targetLabel.includes('inventarisasi') || targetLabel.includes('kekuatan') || targetLabel.includes('kelemahan') || targetLabel.includes('peluang') || targetLabel.includes('ancaman')) {
            // SWOT Inventarisasi items (labels like "Inventarisasi Kekuatan (Strengths) SWOT")
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: INVENTARISASI SWOT]
- Input yang diisi adalah poin inventarisasi analisis SWOT untuk kategori "${label}".
- JANGAN membuat Visi, Misi, KPI, atau Mitigasi Risiko. Hanya berikan poin-poin inventarisasi SWOT sesuai kategori.
- Formulasikan 1 pernyataan faktual singkat yang sesuai kategori (Kekuatan/Kelemahan = faktor internal, Peluang/Ancaman = faktor eksternal rumah sakit).
- Hubungkan dengan aspek klinis, kepuasan pasien, SDM, atau dukungan teknologi informasi medis di rumah sakit.
`;
        } else if (targetLabel.includes('nama rencana strategis') || targetLabel.includes('renstra')) {
            // Renstra name field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: NAMA RENCANA STRATEGIS]
- Input yang diisi adalah NAMA/JUDUL rencana strategis rumah sakit.
- Berikan 1 nama rencana strategis yang ringkas, jelas, dan mencerminkan sasaran strategis rumah sakit (contoh: "Peningkatan Mutu Pelayanan Klinis", "Optimalisasi Tata Kelola SDM").
- JANGAN berikan deskripsi panjang, visi, misi, atau daftar indikator di sini.
`;
        } else if (targetLabel === 'deskripsi' || (targetLabel.includes('deskripsi') && !targetLabel.includes('risiko'))) {
            // Generic description fields (Renstra deskripsi)
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: DESKRIPSI RENCANA STRATEGIS]
- Input yang diisi adalah deskripsi/uraian dari rencana strategis.
- Berikan 2-3 kalimat penjelasan yang menggambarkan ruang lingkup, tujuan, dan manfaat rencana strategis tersebut bagi rumah sakit.
- JANGAN berikan poin KPI, SWOT, atau mitigasi risiko di sini.
`;
        } else if (targetLabel === 'target') {
            // Target field (Renstra)
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: TARGET SASARAN STRATEGIS]
- Input yang diisi adalah TARGET yang ingin dicapai dalam rencana strategis rumah sakit.
- Berikan target yang spesifik, terukur, dan realistis (contoh: "Meningkatkan angka kepuasan pasien rawat inap menjadi ≥ 85% pada akhir tahun anggaran").
- JANGAN berikan deskripsi, visi, misi, atau daftar indikator di sini.
`;
        } else if (targetLabel.includes('indikator') || targetLabel.includes('kpi') || targetLabel.includes('ikt') || targetLabel.includes('kinerja')) {
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: INDIKATOR KINERJA / KPI]
- Input yang diisi adalah Indikator Kinerja Utama (IKU)/IKT untuk bidang "${label}".
- JANGAN membuat Visi, SWOT, atau Mitigasi Risiko.
- Buatlah rumusan indikator yang SMART (Specific, Measurable, Achievable, Relevant, Time-bound).
- Berikan rumusan indikator yang jelas beserta formula persentase/rasio/angka absolut pengukuran yang presisi dan realistis untuk unit kerja rumah sakit.
`;
        } else if (targetLabel.includes('program')) {
            // RKT Program field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: PROGRAM KERJA (RKT)]
- Input yang diisi adalah NAMA PROGRAM KERJA dalam Rencana Kerja Tahunan (RKT) rumah sakit.
- Berikan 1 nama program kerja yang ringkas dan berorientasi capaian (contoh: "Program Peningkatan Kepatuhan Cuci Tangan", "Program Optimalisasi Respon IGD").
- JANGAN berikan deskripsi kegiatan rinci, KPI, atau mitigasi risiko di sini.
`;
        } else if (targetLabel.includes('kegiatan')) {
            // RKT Kegiatan field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: KEGIATAN (RKT)]
- Input yang diisi adalah RINCIAN KEGIATAN dalam Rencana Kerja Tahunan (RKT) rumah sakit.
- Berikan 2-3 butir kegiatan operasional yang terukur, diawali verba tindakan aktif, dan relevan dengan program kerja rumah sakit (contoh: "Menyelenggarakan pelatihan SBAR-TBAK bagi seluruh perawat IGD sebanyak 2 kali per semester").
- JANGAN berikan nama program, visi, misi, atau analisis risiko di sini.
`;
        } else if (targetLabel.includes('kendala') || targetLabel.includes('masalah')) {
            // Evaluasi-IKT Kendala/Masalah field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: KENDALA / MASALAH EVALUASI]
- Input yang diisi adalah KENDALA atau MASALAH yang ditemui pada evaluasi pencapaian indikator kinerja.
- Uraikan permasalahan factual yang menghambat pencapaian target, terkait SDM, anggaran, infrastruktur, atau regulasi.
- JANGAN berikan solusi/tindak lanjut, KPI, atau SWOT di sini. Fokus HANYA pada uraian kendala.
`;
        } else if (targetLabel.includes('tindak lanjut') || targetLabel.includes('action plan')) {
            // Evaluasi-IKT Tindak Lanjut field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: TINDAK LANJUT / ACTION PLAN]
- Input yang diisi adalah RENCANA TINDAK LANJUT atau ACTION PLAN untuk mengatasi kendala evaluasi pencapaian indikator kinerja.
- Berikan 2-4 langkah tindakan perbaikan yang konkret, berurutan, dan diawali verba tindakan aktif.
- Solusi harus realistis dan sesuai batasan rumah sakit (waktu, biaya, sumber daya).
- JANGAN membuat ulang deskripsi kendala, KPI, atau SWOT di sini.
`;
        } else if (targetLabel.includes('rencana aksi') || targetLabel.includes('mitigasi') || targetLabel.includes('penanganan') || targetLabel.includes('solusi')) {
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: MITIGASI / RENCANA AKSI RISIKO]
- Input yang diisi adalah RENCANA MITIGASI / RENCANA AKSI / TINDAKAN PENANGANAN untuk mengatasi risiko.
- JANGAN membuat Sasaran Strategis, IKT, KPI, SWOT, visi, ataupun deskripsi risiko baru. Fokus HANYA pada tindakan mitigasi untuk mereduksi dampak/kemungkinan terjadinya risiko.
- Rekomendasi wajib mematuhi batasan solusi (constraints) jika dicantumkan di bawah (contoh: biaya rendah, durasi < 3 bulan, optimasi staf yang ada).
- Sajikan dalam 3-5 poin langkah tindakan operasional yang praktis dan berurutan, masing-masing diawali verba tindakan aktif.
`;
        } else if (targetLabel.includes('dampak')) {
            // Dampak Risiko field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: DAMPAK RISIKO]
- Input yang diisi adalah DAMPAK yang mungkin terjadi apabila risiko terealisasi.
- Uraikan dampak secara langsung: dampak klinis terhadap pasien, dampak operasional, dampak finansial, atau dampak reputasi bagi rumah sakit.
- Sajikan dalam 1-2 kalimat deskriptif tanpa menyebutkan mitigasi atau penyebab.
`;
        } else if (targetLabel.includes('akar penyebab')) {
            // Akar Penyebab field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: AKAR PENYEBAB RISIKO]
- Input yang diisi adalah AKAR PENYEBAB (root cause) dari risiko yang teridentifikasi.
- Gunakan pendekatan analisis akar masalah (RCA / Fishbone / 5-Why) untuk menemukan penyebab utama.
- Sajikan dalam 1-2 kalimat yang mengidentifikasi faktor dasar penyebab, bukan gejala permukaan.
- JANGAN berikan mitigasi, dampak, atau KPI di sini.
`;
        } else if (targetLabel.includes('penyebab')) {
            // Penyebab Risiko field
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: PENYEBAB RISIKO]
- Input yang diisi adalah PENYEBAB RISIKO (langsung maupun tidak langsung).
- Uraikan faktor-faktor yang menyebabkan risiko dapat terjadi, terkait proses, manusia, peralatan, atau lingkungan.
- Sajikan dalam 1-2 kalimat deskriptif tanpa menyebutkan dampak atau mitigasi.
`;
        } else if (targetLabel.includes('deskripsi risiko') || targetLabel.includes('identifikasi') || targetLabel.includes('hambatan')) {
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: IDENTIFIKASI / DESKRIPSI RISIKO]
- Input yang diisi adalah deskripsi dari risiko yang teridentifikasi.
- JANGAN memberikan rekomendasi mitigasi, KPI/IKT, atau SWOT di sini.
- Gunakan struktur standar: [Deskripsi Kejadian Risiko] akibat [Penyebab akar masalah] sehingga berpotensi menyebabkan [Dampak klinis/non-klinis bagi rumah sakit].
`;
        } else {
            inputSpecificInstruction = `
[PENTING - KONTRAK INPUT: UMUM]
- Berikan saran isian yang relevan langsung dengan bidang "${label}".
- JANGAN campurkan dengan informasi form isian jenis lain.
`;
        }

        // 3. Build full system prompt incorporating grounding contexts
        const contextLines: string[] = [];
        if (extra.organisasi) contextLines.push(`- Organisasi & Nilai Inti: ${extra.organisasi}`);
        if (extra.unit_kerja) contextLines.push(`- Unit Kerja Sasaran: ${extra.unit_kerja}`);
        if (extra.tema_lokus) contextLines.push(`- Tema & Lokus Pembahasan: ${extra.tema_lokus}`);
        if (extra.jangkar_data) contextLines.push(`- Acuan Dokumen (Grounding): ${extra.jangkar_data}`);
        if (extra.kunci_pintu_keluar) contextLines.push(`- Batasan Solusi (Constraints): ${extra.kunci_pintu_keluar}`);
        if (extra.spesifikasi_output) contextLines.push(`- Format Keluaran (Output Specification): ${extra.spesifikasi_output}`);
        if (extra.sumber_informasi) contextLines.push(`- Referensi Utama: ${extra.sumber_informasi}`);

        const promptKonteks = contextLines.length > 0
            ? `\n\n[Konteks & Batasan Grounding Rumah Sakit]:\n${contextLines.join('\n')}`
            : '';

        const fullSystemPrompt = `${baseSystemPrompt}
${promptKonteks}
${inputSpecificInstruction}

Konteks Halaman / Label Form Input: ${label || 'Mitigasi Risiko'}

PERATURAN REVISI KELUARAN (SANGAT KETAT):
- Respons Anda HARUS 100% didasarkan pada tipe isian yang diterangkan dalam "[PENTING - KONTRAK INPUT: ...]".
- JANGAN PERNAH menyertakan, mencampur, atau merekomendasikan tipe isian lain (misalnya: dilarang mencantumkan "Sasaran Strategis" atau "KPI" apabila sedang mengisi "Mitigasi Risiko").
- JANGAN menuliskan kata pengantar seperti "Tentu, berikut saran...", atau kutipan tanda tanya, atau salam penutup.
- Respons Anda harus langsung siap digunakan, bersih, dan berupa saran isian teks yang utuh. Jangan biarkan kalimat terpotong di akhir.`;

        // 4. Coordinate API provider execution
        let textResult = '';
        let modelUsed = '';
        const errorsLog: string[] = [];

        if (modelTerpilih === 'openai') {
            textResult = await callOpenAI(openaiKey, fullSystemPrompt, userPrompt);
            modelUsed = 'OpenAI (GPT-4o)';
        } else if (modelTerpilih === 'gemini') {
            textResult = await callGemini(geminiKey, fullSystemPrompt, userPrompt);
            modelUsed = 'Google Gemini (Flash)';
        } else if (modelTerpilih === 'openrouter') {
            textResult = await callOpenRouter(openrouterKey, fullSystemPrompt, userPrompt);
            modelUsed = 'OpenRouter (GPT-4o)';
        } else if (modelTerpilih === 'auto') {
            // Sequential Auto-Failover: OpenAI -> Gemini -> OpenRouter

            // Step A: OpenAI
            try {
                textResult = await callOpenAI(openaiKey, fullSystemPrompt, userPrompt);
                modelUsed = 'OpenAI (GPT-4o)';
            } catch (err: any) {
                errorsLog.push(`OpenAI gagal: ${err.message || err}`);

                // Step B: Gemini
                try {
                    textResult = await callGemini(geminiKey, fullSystemPrompt, userPrompt);
                    modelUsed = 'Google Gemini (Flash) [Fallback 1]';
                } catch (geminiErr: any) {
                    errorsLog.push(`Gemini gagal: ${geminiErr.message || geminiErr}`);

                    // Step C: OpenRouter
                    try {
                        textResult = await callOpenRouter(openrouterKey, fullSystemPrompt, userPrompt);
                        modelUsed = 'OpenRouter (GPT-4o) [Fallback 2]';
                    } catch (routerErr: any) {
                        errorsLog.push(`OpenRouter gagal: ${routerErr.message || routerErr}`);
                    }
                }
            }

            if (!textResult) {
                return NextResponse.json({
                    error: 'Semua provider AI gagal memproses permintaan.',
                    detail: errorsLog.join(' | ')
                }, { status: 502 });
            }
        } else {
            // Fallback for custom model labels matching general choices
            try {
                if (modelTerpilih.includes('gemini')) {
                    textResult = await callGemini(geminiKey, fullSystemPrompt, userPrompt);
                    modelUsed = `Google Gemini (${modelTerpilih})`;
                } else if (modelTerpilih.includes('gpt') || modelTerpilih.includes('openai')) {
                    textResult = await callOpenAI(openaiKey, fullSystemPrompt, userPrompt);
                    modelUsed = `OpenAI (${modelTerpilih})`;
                } else {
                    // Try auto by default
                    textResult = await callOpenAI(openaiKey, fullSystemPrompt, userPrompt);
                    modelUsed = 'OpenAI';
                }
            } catch (err: any) {
                return NextResponse.json({
                    error: `Gagal memanggil model ${modelTerpilih}: ${err.message || err}`
                }, { status: 502 });
            }
        }

        // Clean up any stray leading/trailing quotes or markdown backticks if returned in response
        let cleanedResult = textResult.trim();
        if (cleanedResult.startsWith('"') && cleanedResult.endsWith('"')) {
            cleanedResult = cleanedResult.slice(1, -1).trim();
        }
        if (cleanedResult.startsWith('`') && cleanedResult.endsWith('`')) {
            cleanedResult = cleanedResult.slice(1, -1).trim();
        }

        return NextResponse.json({
            success: true,
            result: cleanedResult,
            model_used: modelUsed
        });

    } catch (err: any) {
        return NextResponse.json({
            error: err.message || 'Terjadi kesalahan internal.'
        }, { status: 500 });
    }
}
