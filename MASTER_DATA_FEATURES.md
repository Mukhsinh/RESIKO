# Master Data Features - Import/Export Documentation

## Fitur Baru yang Ditambahkan

Semua halaman master data (/master/unit-kerja, /master/tahun, /master/pengguna) sekarang dilengkapi dengan:

### 1. Unduh Template Excel
- Tombol untuk mengunduh template Excel kosong
- Template sudah memiliki header kolom yang sesuai
- Memudahkan pengguna untuk menyiapkan data import

### 2. Export Data ke Excel
- Ekspor semua data yang ada ke file Excel
- File dapat digunakan sebagai backup atau untuk analisis
- Format file: .xlsx

### 3. Import Data dari Excel
- Upload file Excel untuk import data massal
- Validasi otomatis untuk memastikan data valid
- Menampilkan jumlah data yang berhasil/gagal diimport

### 4. Tambah Data Manual
- Form modal untuk menambah data satu per satu
- Validasi input real-time
- Simpan langsung ke database Supabase

## Cara Menggunakan

### Unit Kerja (/master/unit-kerja)

**Template Excel:**
- Kolom: Nama Unit Kerja

**Contoh Data:**
```
Nama Unit Kerja
IGD
ICU
Rawat Inap
Poliklinik
```

### Tahun Anggaran (/master/tahun)

**Template Excel:**
- Kolom: Tahun, Keterangan, Aktif (true/false)

**Contoh Data:**
```
Tahun | Keterangan           | Aktif
2024  | Tahun Anggaran 2024  | false
2025  | Tahun Anggaran 2025  | false
2026  | Tahun Anggaran 2026  | true
```

### Pengguna (/master/pengguna)

**Template Excel:**
- Kolom: Email, Password, Role (superadmin/user_unit), Unit Kerja ID

**Contoh Data:**
```
Email                | Password    | Role       | Unit Kerja ID
user1@rsud.go.id    | password123 | user_unit  | uuid-unit-kerja-1
admin@rsud.go.id    | admin123    | superadmin | 
```

**Catatan:** 
- Untuk mendapatkan Unit Kerja ID, export data unit kerja terlebih dahulu
- Superadmin tidak memerlukan Unit Kerja ID

## Teknologi yang Digunakan

- **xlsx**: Library untuk membaca dan menulis file Excel
- **Supabase**: Database PostgreSQL dengan RLS
- **React Hooks**: useState, useRef, useCallback untuk state management
- **TypeScript**: Type safety untuk data import/export

## Database Schema

### Tabel tahun_anggaran (Baru)
```sql
CREATE TABLE public.tahun_anggaran (
    id UUID PRIMARY KEY,
    tahun INTEGER NOT NULL UNIQUE,
    keterangan TEXT,
    aktif BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE
);
```

## Validasi Data

### Unit Kerja
- Nama unit tidak boleh kosong
- Duplikasi nama akan ditolak oleh database

### Tahun Anggaran
- Tahun harus berupa angka
- Tahun harus unik
- Hanya satu tahun yang bisa aktif

### Pengguna
- Email harus valid dan unik
- Password minimal 8 karakter
- Role harus 'superadmin' atau 'user_unit'
- User unit harus memiliki Unit Kerja ID

## Error Handling

Semua fungsi import dilengkapi dengan:
- Try-catch untuk menangkap error
- Alert untuk memberikan feedback ke user
- Console.error untuk debugging
- Reset file input setelah import

## Keamanan

- Semua operasi database menggunakan RLS (Row Level Security)
- Superadmin memiliki akses penuh
- User unit hanya bisa melihat data unit mereka
- Password di-hash oleh Supabase Auth

## Migration

Untuk menerapkan tabel tahun_anggaran ke database:

```bash
# Jika menggunakan Supabase CLI
supabase db push

# Atau jalankan manual di Supabase Dashboard > SQL Editor
# File: supabase/migrations/20260412_add_tahun_anggaran.sql
```

## Testing

Untuk menguji fitur:

1. Unduh template Excel
2. Isi dengan data sample
3. Import file Excel
4. Verifikasi data tersimpan di database
5. Export data untuk memastikan format benar
6. Tambah data manual melalui form
7. Edit dan hapus data untuk memastikan CRUD lengkap
