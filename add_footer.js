const fs = require('fs');
const path = require('path');

const filePaths = [
    'src/app/dashboard/layout.tsx',
    'src/app/laporan/layout.tsx',
    'src/app/master/layout.tsx',
    'src/app/pedoman/layout.tsx',
    'src/app/pengaturan/layout.tsx',
    'src/app/risiko/layout.tsx',
    'src/app/strategi/layout.tsx',
];

filePaths.forEach(relPath => {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');

    // Add import statement for AppFooter
    if (!content.includes('AppFooter')) {
        content = content.replace("import Sidebar from '@/components/Sidebar';", "import Sidebar from '@/components/Sidebar';\nimport AppFooter from '@/components/AppFooter';");

        // ensure valid replacement
        if (!content.includes('AppFooter')) {
            content = "import AppFooter from '@/components/AppFooter';\n" + content;
        }

        // append inside the main container below children
        content = content.replace('{children}', '{children}\n                    <AppFooter />');

        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${relPath}`);
    }
});
