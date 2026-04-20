const fs = require('fs');
const path = require('path');

const libraryPath = path.join(__dirname, '../../library');
const manifestPath = path.join(__dirname, '../../manifest.json');

function generateIndex() {
    const manifest = {
        library_name: "Script Codex",
        books: []
    };

    // 讀取 library 下的所有資料夾
    const bookDirs = fs.readdirSync(libraryPath).filter(file => {
        return fs.statSync(path.join(libraryPath, file)).isDirectory();
    });

    bookDirs.forEach(dir => {
        const identityPath = path.join(libraryPath, dir, 'identity.json');
        
        if (fs.existsSync(identityPath)) {
            const identity = JSON.parse(fs.readFileSync(identityPath, 'utf8'));
            
            // 自動抓取該書本內所有 .txt 檔案的最新修改日期
            let latestDate = 0;
            if (identity.scripts && identity.scripts.length > 0) {
                identity.scripts.forEach(script => {
                    const scriptPath = path.join(libraryPath, dir, script.file);
                    if (fs.existsSync(scriptPath)) {
                        const stats = fs.statSync(scriptPath);
                        if (stats.mtimeMs > latestDate) {
                            latestDate = stats.mtimeMs; // 記錄最晚的修改時間
                        }
                    }
                });
            }
            
            // 格式化日期為 YYYY-MM-DD
            const updateDate = latestDate > 0 ? new Date(latestDate).toISOString().split('T')[0] : '未知';

            manifest.books.push({
                id: dir,
                title: identity.title || dir,
                author: identity.author || "未知", 
                path: `library/${dir}/`,
                category: identity.category || "未分類",
                order: identity.order || 999, // 若未設定 order，預設排到最後
                last_updated: updateDate
            });
        }
    });

    // 依照 order 權重進行排序 (數字越小，排越前面)
    manifest.books.sort((a, b) => a.order - b.order);

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log("✅ [MimiBot] manifest.json 自動抓取日期與排序完成！");
}

generateIndex();
