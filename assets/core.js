// 核心引擎邏輯：偵測頁面並啟動對應功能
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // 根據網址判斷是在書架頁還是閱讀頁
    if (path.includes('shelf.html') || path.endsWith('/')) {
        loadShelf();
    } else if (path.includes('engine.html')) {
        loadReader();
    }
});

// --- 書架邏輯：生成玻璃質感卡片 ---
async function loadShelf() {
    const container = document.getElementById('shelf-container');
    if (!container) return;

    try {
        const response = await fetch('manifest.json');
        const data = await response.json();
        
        // 生成符合 style.css 玻璃質感的 HTML 結構
        container.innerHTML = data.books.map(book => `
            <div class="book-card" onclick="location.href='engine.html?book=${book.id}'">
                <h3>${book.title}</h3>
                <p>編號：${book.id}</p>
                <p>分類：${book.category}</p>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = "<div class='system-text'>─[系統錯誤：無法讀取藏書閣數據]─</div>";
        console.error("Shelf Load Error:", e);
    }
}

// --- 閱讀器邏輯：抓取內容與標題 ---
async function loadReader() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book');
    const contentArea = document.getElementById('script-content');

    if (!bookId) {
        if (contentArea) contentArea.innerHTML = "<p class='line'>未指定書籍，請返回書架。</p>";
        return;
    }

    try {
        // 抓取書籍身份資料
        const idResponse = await fetch(`library/${bookId}/identity.json`);
        const bookInfo = await idResponse.json();
        document.getElementById('current-book-title').innerText = bookInfo.title;

        // 預設載入第一章節
        const firstScript = bookInfo.scripts[0].file;
        const scriptResponse = await fetch(`library/${bookId}/${firstScript}`);
        const rawContent = await scriptResponse.text();
        
        // 使用墨影琉璃引擎解析內容並注入
        contentArea.innerHTML = parseCodexContent(rawContent);

    } catch (e) {
        if (contentArea) contentArea.innerHTML = "<div class='system-text'>─[錯誤：無法開啟書頁，請確認路徑正確]─</div>";
        console.error("Reader Load Error:", e);
    }
}

// --- 墨影琉璃：符號解析引擎 ---
function parseCodexContent(text) {
    const lines = text.trim().split('\n');
    let htmlOutput = '';

    lines.forEach((line) => {
        let trimmedLine = line.trim();
        if (!trimmedLine) return;

        // 1. 系統訊息：以 ─ 開頭
        if (trimmedLine.startsWith('─')) {
            htmlOutput += `<div class="system-text">${trimmedLine}</div>`;
            return;
        }

        // 2. 對白偵測：加粗引號內容
        if (trimmedLine.includes('「')) {
            trimmedLine = trimmedLine.replace(/「(.*?)」/g, '<span class="dialogue">「$1」</span>');
        }

        // 3. 內心獨白：處理小括號
        if (trimmedLine.includes('（')) {
            trimmedLine = `<span class="thought">${trimmedLine}</span>`;
        }

        // 4. 數據與百分比強調
        trimmedLine = trimmedLine.replace(/(\d+(\.\d+)?(次|則|「1」|％|%))/g, '<span class="stat-highlight">$1</span>');

        htmlOutput += `<p class="line">${trimmedLine}</p>`;
    });

    return htmlOutput;
}

// --- 主題切換邏輯 ---

// 切換背景模式 (white, beige, black)
function setMode(mode) {
    document.body.className = `mode-${mode}`;
    updateThemeEffects(mode, null); // 更新對應的 RGB 發光值
}

// 切換意境顏色 (blood, curse, ice, undead)
function setMood(mood) {
    // 從 classList 中精確抓取當前的 mode
    const currentClass = Array.from(document.body.classList).find(c => c.startsWith('mode-'));
    const currentMode = currentClass ? currentClass.replace('mode-', '') : 'beige';
    
    updateThemeEffects(currentMode, mood);
}

// 物理光學同步：更新 CSS 變數中的 RGB 值，產生玻璃落地光暈效果
function updateThemeEffects(bg, mood) {
    const isDark = bg === 'black';
    const accentKey = mood || 'blood'; // 若無指定則預設為 blood

    // 對應 style.css 中的顏色變數
    const rgbMatrix = {
        light: { 
            blood: '139, 45, 45', 
            curse: '45, 139, 90', 
            ice: '45, 90, 139', 
            undead: '74, 74, 74' 
        },
        dark: { 
            blood: '255, 138, 138', 
            curse: '138, 255, 193', 
            ice: '138, 212, 255', 
            undead: '209, 209, 209' 
        }
    };

    const rgbValue = rgbMatrix[isDark ? 'dark' : 'light'][accentKey];
    
    // 注入全域 CSS 變數
    document.documentElement.style.setProperty('--accent-rgb', rgbValue);
    
    // 如果是 Mood 切換，也要更新主色調變數
    const colorHex = isDark ? `var(--ice-${accentKey})` : `var(--ink-${accentKey})`;
    document.documentElement.style.setProperty('--current-accent', colorHex);
}

// 將函數暴露至全域，確保 HTML onclick 能觸發
window.setMode = setMode;
window.setMood = setMood;
