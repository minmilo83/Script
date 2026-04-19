// 核心引擎邏輯
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('shelf.html')) {
        loadShelf();
    } else if (path.includes('engine.html')) {
        loadReader();
        // --- 墨影琉璃：符號解析引擎 ---
function parseCodexContent(text) {
    const lines = text.trim().split('\n');
    let htmlOutput = '';

    lines.forEach((line) => {
        let trimmedLine = line.trim();
        if (!trimmedLine) return;

        // 1. 系統訊息偵測 (以 ─ 開頭)
        if (trimmedLine.startsWith('─')) {
            htmlOutput += `<div class="system-text">${trimmedLine}</div>`;
            return;
        }

        // 2. 對白偵測 (包含 「」)
        if (trimmedLine.includes('「')) {
            trimmedLine = trimmedLine.replace(/「(.*?)」/g, '<span class="dialogue">「$1」</span>');
        }

        // 3. 內心獨白偵測 (包含 （）)
        if (trimmedLine.includes('（')) {
            trimmedLine = `<span class="thought">${trimmedLine}</span>`;
        }

        // 4. 數據強調偵測 (數字與特定單位)
        trimmedLine = trimmedLine.replace(/(\d+(\.\d+)?(次|則|「1」|％|%))/g, '<span class="stat-highlight">$1</span>');

        htmlOutput += `<p class="line">${trimmedLine}</p>`;
    });

    return htmlOutput;
}
    }
});

// --- 書架邏輯 ---
async function loadShelf() {
    const container = document.getElementById('shelf-container');
    try {
        const response = await fetch('manifest.json');
        const data = await response.json();
        
        container.innerHTML = data.books.map(book => `
    <div class="book-card" onclick="location.href='engine.html?book=${book.id}'">
        <h3>${book.title}</h3>
        <p>編號：${book.id}</p>
        <p>分類：${book.category}</p>
    </div>
`).join('');
    } catch (e) {
        container.innerHTML = "無法加載書架內容。";
    }
}

// --- 閱讀器邏輯 ---
async function loadReader() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book');
    const contentArea = document.getElementById('script-content');

    if (!bookId) {
        contentArea.innerHTML = "未指定書籍。";
        return;
    }

   // ...前面的代碼保持不變...
try {
    const idResponse = await fetch(`library/${bookId}/identity.json`);
    const bookInfo = await idResponse.json();
    document.getElementById('current-book-title').innerText = bookInfo.title;

    const firstScript = bookInfo.scripts[0].file;
    const scriptResponse = await fetch(`library/${bookId}/${firstScript}`);
    const rawContent = await scriptResponse.text(); // 改成抓取原始文字
    
    // 【關鍵修改】：使用解析引擎處理內容
    contentArea.innerHTML = parseCodexContent(rawContent);

} catch (e) {
    // ...錯誤處理保持不變...
}
// --- 主題切換邏輯 ---
function setMode(mode) {
    document.body.className = `mode-${mode}`;
    updateThemeEffects(mode, null);
}

function setMood(mood) {
    const currentMode = document.body.className.replace('mode-', '') || 'beige';
    updateThemeEffects(currentMode, mood);
}

function updateThemeEffects(bg, mood) {
    const isDark = bg === 'black';
    const accentKey = mood || 'blood';

    // RGB 矩陣用於控制玻璃光暈
    const rgbMatrix = {
        light: { blood: '139, 45, 45', curse: '45, 139, 90', ice: '45, 90, 139', undead: '74, 74, 74' },
        dark: { blood: '255, 138, 138', curse: '138, 255, 193', ice: '138, 212, 255', undead: '209, 209, 209' }
    };

    const rgbValue = rgbMatrix[isDark ? 'dark' : 'light'][accentKey];
    document.documentElement.style.setProperty('--accent-rgb', rgbValue);
}

// 暴露函數給 HTML 點擊事件使用
window.setMode = setMode;
window.setMood = setMood;
