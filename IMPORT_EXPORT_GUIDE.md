# Panduan Import/Export Data Master

## Fitur yang Ditambahkan

Semua halaman di `/master/` sekarang memiliki 3 tombol baru:
1. **Unduh Template** - Download template Excel untuk import data
2. **Import Data** - Upload file Excel untuk import data massal
3. **Tambah Data** - Form manual untuk menambah data satu per satu (sudah ada sebelumnya)

## Cara Menggunakan

### 1. Master Unit Kerja (`/master/unit-kerja`)

**Template Excel:**
| Nama Unit Kerja |
|-----------------|
| IGD             |
| ICU             |
| Rawat Inap      |

**Langkah-langkah:**
1. Klik tombol "Unduh Template" untuk download template Excel
2. Isi kolom "Nama Unit Kerja" dengan nama unit yang ingin ditambahkan
3. Simpan file Excel
4. Klik tombol "Import Data" dan pilih file yang sudah diisi
5. Data akan otomatis tersimpan ke database

### 2. Master Tahun Anggaran (`/master/tahun`)

**Template Excel:**
| Tahun | Keterangan           | Aktif (true/false) |
|-------|----------------------|--------------------|
| 2024  | Tahun Anggaran 2024  | false              |
| 2025  | Tahun Anggaran 2025  | true               |
| 2026  | Tahun Anggaran 2026  | false              |

**Langkah-langkah:**
1. Klik tombol "Unduh Template"
2. Isi data tahun anggaran:
   - **Tahun**: Angka tahun (contoh: 2024)
   - **Keterangan**: Deskripsi tahun anggaran
   - **Aktif**: Tulis `true` atau `false` (hanya 1 tahun yang boleh aktif)
3. Simpan dan import file Excel
4. Sistem akan otomatis menyimpan ke database

### 3. Master Pengguna (`/master/pengguna`)

**Template Excel:**
| Email                  | Password    | Role (superadmin/user_unit) | Unit Kerja ID (optional)      |
|------------------------|-------------|------------------------------|-------------------------------|
| admin@rsud.go.id       | password123 | superadmin                   |                               |
| user1@rsud.go.id       | password123 | user_unit                    | uuid-unit-kerja-1             |
| user2@rsud.go.id       | password123 | user_unit                    | uuid-unit-kerja-2             |

**Langkah-langkah:**
1. Klik tombol "Unduh Template"
2. Isi data pengguna:
   - **Email**: Email pengguna (harus valid dan unik)
   - **Password**: Password awal (minimal 8 karakter)
   - **Role**: Pilih `superadmin` atau `user_unit`
   - **Unit Kerja ID**: Kosongkan untuk superadmin, isi UUID unit kerja untuk user_unit
3. Untuk mendapatkan Unit Kerja ID:
   - Buka halaman Master Unit Kerja
   - Lihat data di tabel atau database untuk mendapatkan UUID
4. Import file Excel
5. Sistem akan membuat akun user dan profile secara otomatis

**Catatan Penting untuk Import Pengguna:**
- Jika ada error pada salah satu baris, baris lainnya tetap akan diproses
- Sistem akan menampilkan ringkasan: berapa yang berhasil dan berapa yang gagal
- Email yang sudah terdaftar akan menghasilkan error

## Validasi Data

### Unit Kerja
- Nama unit kerja tidak boleh kosong
- Duplikasi nama diperbolehkan (sistem tidak memblokir)

### Tahun Anggaran
- Tahun harus berupa angka
- Tahun harus unik (tidak boleh duplikat)
- Hanya 1 tahun yang boleh aktif pada satu waktu

### Pengguna
- Email harus valid dan unik
- Password minimal 8 karakter
- Role harus `superadmin` atau `user_unit`
- User_unit harus memiliki unit_kerja_id yang valid

## Format File Excel

- Format yang didukung: `.xlsx` dan `.xls`
- Baris pertama adalah header (akan diabaikan saat import)
- Data dimulai dari baris kedua
- Baris kosong akan diabaikan
- Kolom harus sesuai urutan template

## Troubleshooting

### Import Gagal
- Pastikan format file adalah Excel (.xlsx atau .xls)
- Pastikan header kolom sesuai dengan template
- Pastikan tidak ada baris yang benar-benar kosong di tengah data
- Periksa console browser untuk error detail

### Data Tidak Muncul
- Refresh halaman setelah import
- Periksa apakah ada error message yang muncul
- Cek database untuk memastikan data tersimpan

### Import Pengguna Gagal
- Pastikan email belum terdaftar
- Pastikan password minimal 8 karakter
- Pastikan Unit Kerja ID valid (jika role = user_unit)
- Periksa koneksi ke Supabase Auth

## Teknologi yang Digunakan

- **xlsx**: Library untuk membaca dan menulis file Excel
- **Supabase**: Database dan authentication
- **React**: Frontend framework
- **TypeScript**: Type safety

## Database Tables

### unit_kerja
```sql
CREATE TABLE unit_kerja (
    id UUID PRIMARY KEY,
    nama_unit TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE
);
```

### tahun_anggaran
```sql
CREATE TABLE tahun_anggaran (
    id UUID PRIMARY KEY,
    tahun INTEGER UNIQUE NOT NULL,
    keterangan TEXT,
    aktif BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE
);
```

### profiles
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users,
    email TEXT,
    role TEXT,
    unit_kerja_id UUID REFERENCES unit_kerja(id),
    created_at TIMESTAMP WITH TIME ZONE
);
```

## Keamanan

- Semua tabel menggunakan Row Level Security (RLS)
- Hanya authenticated users yang bisa mengakses data
- Import pengguna menggunakan Supabase Auth Admin API
- Password di-hash otomatis oleh Supabase Auth

## Future Improvements

- [ ] Export data existing ke Excel
- [ ] Validasi data lebih detail sebelum import
- [ ] Progress bar untuk import data besar
- [ ] Batch processing untuk import ribuan data
- [ ] Template dengan contoh data
- [ ] Undo import terakhir
