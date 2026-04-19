const fs = require('fs');
const path = require('path');

const libraryPath = path.join(__dirname, '../../library');
const manifestPath = path.join(__dirname, '../../manifest.json');

// 1. 掃描 library 資料夾下的所有子目錄
const books = fs.readdirSync(libraryPath).filter(file => {
    return fs.statSync(path.join(libraryPath, file)).isDirectory();
});

const manifestData = {
    library_name: "Script Codex",
    books: []
};

books.forEach(bookId => {
    const bookDir = path.join(libraryPath, bookId);
    const idPath = path.join(bookDir, 'identity.json');

    // 檢查是否有 identity.json，以此作為書籍標題來源
    if (fs.existsSync(idPath)) {
        const idData = JSON.parse(fs.readFileSync(idPath, 'utf8'));
        
        manifestData.books.push({
            id: bookId,
            title: idData.title || bookId,
            path: `library/${bookId}/`,
            category: idData.category || "未分類" // 妳可以在 identity.json 加這行
        });

        // 自動掃描該書資料夾下的所有 .txt，按檔名排序更新 identity.json
        const txtFiles = fs.readdirSync(bookDir)
            .filter(f => f.endsWith('.txt'))
            .sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
            .map(f => ({ file: f }));

        idData.scripts = txtFiles;
        fs.writeFileSync(idPath, JSON.stringify(idData, null, 2));
    }
});

// 2. 寫入總目錄 manifest.json
fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
console.log('✅ 機器人已成功同步書架與章節！');
