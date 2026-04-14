import * as XLSX from 'xlsx';

export interface ExcelColumn {
    header: string;
    key: string;
    width?: number;
}

export function downloadTemplate(filename: string, columns: ExcelColumn[]) {
    const ws = XLSX.utils.aoa_to_sheet([columns.map(col => col.header)]);
    
    // Set column widths
    ws['!cols'] = columns.map(col => ({ wch: col.width || 20 }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, filename);
}

export function exportToExcel<T extends Record<string, unknown>>(
    filename: string,
    data: T[],
    columns: ExcelColumn[]
) {
    const rows = data.map(row => 
        columns.map(col => row[col.key] ?? '')
    );
    
    const ws = XLSX.utils.aoa_to_sheet([
        columns.map(col => col.header),
        ...rows
    ]);
    
    // Set column widths
    ws['!cols'] = columns.map(col => ({ wch: col.width || 20 }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename);
}

export async function importFromExcel<T>(
    file: File,
    columns: ExcelColumn[]
): Promise<T[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
                
                if (jsonData.length < 2) {
                    reject(new Error('File tidak memiliki data'));
                    return;
                }
                
                // Skip header row
                const dataRows = jsonData.slice(1);
                
                const result = dataRows
                    .filter(row => row && row.length > 0)
                    .map(row => {
                        const obj: Record<string, unknown> = {};
                        columns.forEach((col, index) => {
                            obj[col.key] = row[index] ?? '';
                        });
                        return obj as T;
                    });
                
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsBinaryString(file);
    });
}
