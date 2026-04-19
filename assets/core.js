/**
 * Script Codex - Core Engine V1.2
 * 核心引擎：偵測頁面並啟動對應功能，並整合閱讀流轉邏輯與動態淡入特效
 */

// 全域狀態：追蹤當前書籍與章節
let currentBookId = "";
let currentChapters = [];
let currentIndex = 0;

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // 根據網址判斷是在書架頁還是閱讀頁
    if (path.includes('shelf.html') || path.endsWith('/') || path.endsWith('index.html')) {
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

// --- 閱讀器邏輯：抓取內容與導航控制 ---
async function loadReader() {
    const params = new URLSearchParams(window.location.search);
    currentBookId = params.get('book');
    const contentArea = document.getElementById('script-content');

    if (!currentBookId) {
        if (contentArea) contentArea.innerHTML = "<p class='line'>未指定書籍，請返回書架。</p>";
        return;
    }

    try {
        // 1. 抓取書籍身份資料 (identity.json)
        const idResponse = await fetch(`library/${currentBookId}/identity.json`);
        const bookInfo = await idResponse.json();
        document.getElementById('current-book-title').innerText = bookInfo.title;

        // 2. 儲存章節清單並判斷當前索引
        currentChapters = bookInfo.scripts;
        const chParam = params.get('ch');
        currentIndex = chParam ? parseInt(chParam) : 0;

        // 3. 初始化按鈕事件
        setupNavigation();

        // 4. 載入內容
        fetchChapter(currentIndex);

    } catch (e) {
        if (contentArea) contentArea.innerHTML = "<div class='system-text'>─[錯誤：無法開啟書頁，請確認路徑正確]─</div>";
        console.error("Reader Load Error:", e);
    }
}

// --- 導航控制：處理上一章與下一章 ---
function setupNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) {
        prevBtn.onclick = () => {
            if (currentIndex > 0) fetchChapter(currentIndex - 1);
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (currentIndex < currentChapters.length - 1) fetchChapter(currentIndex + 1);
        };
    }
}

// --- 載入特定章節並渲染 (含淡入動畫控制) ---
async function fetchChapter(index) {
    const contentArea = document.getElementById('script-content');
    const container = document.querySelector('.reader-container');
    if (!contentArea || !currentChapters[index]) return;

    try {
        currentIndex = index;
        const fileName = currentChapters[currentIndex].file;

        // 1. 抓取 TXT 內容
        const scriptResponse = await fetch(`library/${currentBookId}/${fileName}`);
        const rawContent = await scriptResponse.text();
        
        // 2. 重置動畫：移除類別以準備重新觸發
        if (container) container.classList.remove('fade-in-active');

        // 3. 渲染內容
        contentArea.innerHTML = parseCodexContent(rawContent);

        // 4. 觸發動畫：強制重繪 (reflow) 並加上類別
        if (container) {
            void container.offsetWidth; // 強制重繪技巧
            container.classList.add('fade-in-active');
        }

        // 5. 更新按鈕樣式與網址
        updateNavUI();
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // 更新網址參數 ch，方便書籤紀錄
        const newUrl = `${window.location.pathname}?book=${currentBookId}&ch=${currentIndex}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);

    } catch (e) {
        contentArea.innerHTML = "<div class='system-text'>─[錯誤：無法讀取章節內容]─</div>";
    }
}

// 更新導航按鈕的視覺狀態
function updateNavUI() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) {
        const isFirst = currentIndex === 0;
        prevBtn.style.opacity = isFirst ? "0.3" : "1";
        prevBtn.style.pointerEvents = isFirst ? "none" : "auto";
    }
    if (nextBtn) {
        const isLast = currentIndex === currentChapters.length - 1;
        nextBtn.style.opacity = isLast ? "0.3" : "1";
        nextBtn.style.pointerEvents = isLast ? "none" : "auto";
    }
}

// --- 墨影琉璃：符號解析引擎 ---
function parseCodexContent(text) {
    const lines = text.trim().split('\n');
    let htmlOutput = '';

    lines.forEach((line) => {
        let trimmedLine = line.trim();
        if (!trimmedLine) {
            htmlOutput += `<div style="height: 1.2em;"></div>`; 
            return;
        }

        if (trimmedLine.startsWith('─')) {
            htmlOutput += `<div class="system-text">${trimmedLine}</div>`;
            return;
        }

        if (trimmedLine.includes('「')) {
            trimmedLine = trimmedLine.replace(/「(.*?)」/g, '<span class="dialogue">「$1」</span>');
        }

        if (trimmedLine.includes('（')) {
            trimmedLine = `<span class="thought">${trimmedLine}</span>`;
        }

        trimmedLine = trimmedLine.replace(/(\d+(\.\d+)?(次|則|「1」|％|%|層|級|點))/g, '<span class="stat-highlight">$1</span>');

        htmlOutput += `<p class="line">${trimmedLine}</p>`;
    });

    return htmlOutput;
}

// --- 主題切換邏輯 ---

function setMode(mode) {
    document.body.className = `mode-${mode}`;
    updateThemeEffects(mode, null); 
}

function setMood(mood) {
    const currentClass = Array.from(document.body.classList).find(c => c.startsWith('mode-'));
    const currentMode = currentClass ? currentClass.replace('mode-', '') : 'beige';
    updateThemeEffects(currentMode, mood);
}

function updateThemeEffects(bg, mood) {
    const isDark = bg === 'black';
    const accentKey = mood || 'blood'; 

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
    document.documentElement.style.setProperty('--accent-rgb', rgbValue);
    
    const colorHex = isDark ? `var(--ice-${accentKey})` : `var(--ink-${accentKey})`;
    document.documentElement.style.setProperty('--current-accent', colorHex);
}

window.setMode = setMode;
window.setMood = setMood;
