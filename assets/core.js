/**
 * Script Codex - Core Engine V2.5
 * 核心引擎：支援 Markdown 新語法、沉浸式閱讀體驗、本地記憶與書架動態過濾
 */

// 全域狀態
let currentBookId = "";
let currentChapters = [];
let currentIndex = 0;
let allBooksData = []; // 用於搜尋過濾

// UI 狀態
let isUiVisible = true;
let scrollTimeout;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化使用者偏好 (字體與主題)
    initUserPreferences();

    const path = window.location.pathname;

    // 2. 根據網址判斷頁面邏輯
    if (path.includes('shelf.html') || path.endsWith('/') || path.endsWith('index.html')) {
        checkUserIdentity(); // 檢查暱稱並顯示歡迎語
        loadShelf();
    } else if (path.includes('engine.html')) {
        loadReader();
        initReaderInteractions(); // 啟動沉浸模式與事件監聽
    }
});

// ==========================================
// 📚 書架與全局功能 (Shelf & Global)
// ==========================================

// --- 檢查使用者暱稱與歡迎語 ---
function checkUserIdentity() {
    const username = localStorage.getItem('mimi-username');
    const headerTitle = document.getElementById('welcome-title');
    
    if (username) {
        if (headerTitle) headerTitle.innerText = `${username}，${getGreeting()}。`;
    } else {
        // 若無暱稱，呼叫玻璃輸入盒
        const modal = document.getElementById('welcome-modal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden'; // 防止背景滾動
        }
    }
}

function saveUsername() {
    const input = document.getElementById('username-input');
    if (input && input.value.trim() !== "") {
        localStorage.setItem('mimi-username', input.value.trim());
        const modal = document.getElementById('welcome-modal');
        if (modal) modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        checkUserIdentity();
    }
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "早安";
    if (hour >= 11 && hour < 17) return "午安";
    return "晚安";
}

// --- 書架邏輯：讀取、渲染與搜尋 ---
async function loadShelf() {
    const container = document.getElementById('shelf-container');
    if (!container) return;

    try {
        const response = await fetch('manifest.json');
        const data = await response.json();
        allBooksData = data.books; // 儲存全域資料供搜尋使用
        
        renderShelf(allBooksData);

        // 綁定搜尋事件
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const keyword = e.target.value.toLowerCase();
                const filtered = allBooksData.filter(book => 
                    book.title.toLowerCase().includes(keyword) || 
                    (book.author && book.author.toLowerCase().includes(keyword)) ||
                    book.category.toLowerCase().includes(keyword)
                );
                renderShelf(filtered);
            });
        }
    } catch (e) {
        container.innerHTML = "<div class='system-text'>─[系統錯誤：無法讀取藏書閣數據]─</div>";
        console.error("Shelf Load Error:", e);
    }
}

function renderShelf(books) {
    const container = document.getElementById('shelf-container');
    if (!container) return;

    if (books.length === 0) {
        container.innerHTML = "<p class='line' style='text-align:center;'>找不到相符的藏書。</p>";
        return;
    }

    container.innerHTML = books.map(book => `
        <div class="book-card" onclick="location.href='engine.html?book=${book.id}'">
            <h3>${book.title}</h3>
            <p>作者：${book.author || '未知'}</p>
            <p>分類：${book.category}</p>
            <p style="font-size: 0.75em; opacity: 0.5;">最新更新：${book.last_updated || '未知'}</p>
        </div>
    `).join('');
}


// ==========================================
// 📖 閱讀器核心引擎 (Reader Engine)
// ==========================================

async function loadReader() {
    const params = new URLSearchParams(window.location.search);
    currentBookId = params.get('book');
    const contentArea = document.getElementById('script-content');

    if (!currentBookId) {
        if (contentArea) contentArea.innerHTML = "<p class='line'>未指定書籍，請返回書架。</p>";
        return;
    }

    try {
        // 1. 抓取書籍身份資料
        const idResponse = await fetch(`library/${currentBookId}/identity.json`);
        const bookInfo = await idResponse.json();
        document.getElementById('current-book-title').innerText = bookInfo.title;

        // 2. 儲存章節清單
        currentChapters = bookInfo.scripts;
        const chParam = params.get('ch');
        currentIndex = chParam ? parseInt(chParam) : 0;

        // 3. 初始化功能
        setupNavigation();
        checkHeartStatus(); // 檢查愛心狀態

        // 4. 載入第一筆內容
        fetchChapter(currentIndex);

    } catch (e) {
        if (contentArea) contentArea.innerHTML = "<div class='system-text'>─[錯誤：無法開啟書頁，可能檔案不存在]─</div>";
        console.error("Reader Load Error:", e);
    }
}

async function fetchChapter(index) {
    const contentArea = document.getElementById('script-content');
    const container = document.querySelector('.reader-container');
    if (!contentArea || !currentChapters[index]) return;

    try {
        currentIndex = index;
        const fileName = currentChapters[currentIndex].file;

        const scriptResponse = await fetch(`library/${currentBookId}/${fileName}`);
        const rawContent = await scriptResponse.text();
        
        if (container) container.classList.remove('fade-in-active');

        // 解析 Markdown 並渲染
        contentArea.innerHTML = parseCodexContent(rawContent);

        if (container) {
            void container.offsetWidth; 
            container.classList.add('fade-in-active');
        }

        // 更新狀態
        updateNavUI();
        markChapterAsRead(currentIndex);
        window.scrollTo({ top: 0, behavior: 'auto' });
        updateProgressBar(); // 重置進度條

        // 更新網址
        const newUrl = `${window.location.pathname}?book=${currentBookId}&ch=${currentIndex}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);

    } catch (e) {
        contentArea.innerHTML = "<div class='system-text'>─[錯誤：無法讀取章節內容]─</div>";
    }
}

// ==========================================
// 🖋️ Markdown 解析引擎 (Parser)
// ==========================================

function parseCodexContent(text) {
    const lines = text.trim().split('\n');
    let htmlOutput = '';

    lines.forEach((line) => {
        let trimmedLine = line.trim();
        if (!trimmedLine) {
            htmlOutput += `<div style="height: 1.5em;"></div>`; 
            return;
        }

        // 1. 系統分隔線
        if (trimmedLine.startsWith('─')) {
            htmlOutput += `<div class="system-text">${trimmedLine}</div>`;
            return;
        }

        // 2. 為了避免正則衝突，使用佔位符替換法 (由長到短)
        // 大標題 ***文字***
        trimmedLine = trimmedLine.replace(/\*\*\*(.*?)\*\*\*/g, '%%L%%$1%%EL%%');
        // 小標題 **文字**
        trimmedLine = trimmedLine.replace(/\*\*(.*?)\*\*/g, '%%S%%$1%%ES%%');
        // 粗體 *文字*
        trimmedLine = trimmedLine.replace(/\*(.*?)\*/g, '%%B%%$1%%EB%%');
        // 內心獨白 //文字//
        trimmedLine = trimmedLine.replace(/\/\/(.*?)\/\//g, '%%T%%$1%%ET%%');
        // 斜體 /文字/
        trimmedLine = trimmedLine.replace(/\/(.*?)\//g, '%%I%%$1%%EI%%');

        // 3. 還原 HTML 標籤 (符號消失)
        trimmedLine = trimmedLine.replace(/%%L%%(.*?)%%EL%%/g, '<span class="title-large">$1</span>');
        trimmedLine = trimmedLine.replace(/%%S%%(.*?)%%ES%%/g, '<span class="title-small">$1</span>');
        trimmedLine = trimmedLine.replace(/%%B%%(.*?)%%EB%%/g, '<strong>$1</strong>');
        trimmedLine = trimmedLine.replace(/%%T%%(.*?)%%ET%%/g, '<span class="thought">$1</span>');
        trimmedLine = trimmedLine.replace(/%%I%%(.*?)%%EI%%/g, '<em>$1</em>');

        // 4. 角色對白 (保留「」符號)
        if (trimmedLine.includes('「')) {
            trimmedLine = trimmedLine.replace(/「(.*?)」/g, '<span class="dialogue">「$1」</span>');
        }

        htmlOutput += `<p class="line">${trimmedLine}</p>`;
    });

    return htmlOutput;
}


// ==========================================
// 🕹️ UI 互動與沉浸模式 (Interactions)
// ==========================================

function initReaderInteractions() {
    // 監聽滾動：隱藏 UI 與 更新進度條
    window.addEventListener('scroll', () => {
        updateProgressBar();
        
        if (isUiVisible) {
            document.body.classList.add('ui-hidden');
            const menu = document.getElementById('chapter-menu');
            if (menu) menu.classList.remove('active'); // 滑動時順便關閉選單
            isUiVisible = false;
        }
    });

    // 監聽點擊：呼出 UI (排除 UI 元件本身)
    document.addEventListener('click', (e) => {
        const clickedUI = e.target.closest('.glass-dock') || 
                          e.target.closest('#book-header') || 
                          e.target.closest('.chapter-menu') || 
                          e.target.closest('#reader-nav') ||
                          e.target.closest('.side-progress-container');
        
        if (clickedUI) return; // 點擊 UI 內部不觸發顯示/隱藏切換

        if (!isUiVisible) {
            document.body.classList.remove('ui-hidden');
            isUiVisible = true;
        }
    });
}

// 側邊進度條更新
function updateProgressBar() {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    const bar = document.getElementById('progress-bar-fill');
    if(bar) bar.style.height = scrolled + "%";
}

// --- 字體大小調整 (A+ / A-) ---
function changeFontSize(step) {
    let currentFontSize = parseFloat(localStorage.getItem('mimi-font-size')) || 1.1;
    currentFontSize += step;
    
    // 限制字體大小範圍
    if(currentFontSize < 0.8) currentFontSize = 0.8;
    if(currentFontSize > 2.5) currentFontSize = 2.5;
    
    document.documentElement.style.setProperty('--reader-font-size', currentFontSize + 'rem');
    localStorage.setItem('mimi-font-size', currentFontSize);
}

function initUserPreferences() {
    // 字體初始化
    const savedFontSize = localStorage.getItem('mimi-font-size');
    if (savedFontSize) {
        document.documentElement.style.setProperty('--reader-font-size', savedFontSize + 'rem');
    }
}

// --- 愛心收藏系統 ---
function toggleHeart() {
    let favs = JSON.parse(localStorage.getItem('mimi-favorites') || '[]');
    const btn = document.getElementById('heart-btn');
    
    if (favs.includes(currentBookId)) {
        favs = favs.filter(id => id !== currentBookId); // 移除收藏
        if(btn) btn.classList.remove('heart-active');
    } else {
        favs.push(currentBookId); // 加入收藏
        if(btn) btn.classList.add('heart-active');
    }
    localStorage.setItem('mimi-favorites', JSON.stringify(favs));
}

function checkHeartStatus() {
    let favs = JSON.parse(localStorage.getItem('mimi-favorites') || '[]');
    const btn = document.getElementById('heart-btn');
    if (favs.includes(currentBookId) && btn) {
        btn.classList.add('heart-active');
    }
}

// --- 章回選單與閱讀紀錄 ---
function toggleChapterMenu() {
    const menu = document.getElementById('chapter-menu');
    if (!menu) return;
    
    menu.classList.toggle('active');
    if (menu.classList.contains('active')) {
        renderChapterMenu();
    }
}

function renderChapterMenu() {
    const menu = document.getElementById('chapter-menu');
    const readList = JSON.parse(localStorage.getItem('mimi-read') || '{}');
    const bookReadList = readList[currentBookId] || [];

    menu.innerHTML = currentChapters.map((ch, idx) => {
        const isRead = bookReadList.includes(idx) ? 'read' : '';
        const currentMark = idx === currentIndex ? '★ ' : ''; // 當前章節標記
        // 從檔名中提取章節名稱 (簡單處理)，或直接顯示第X章
        const displayName = ch.file.replace('.txt', ''); 
        
        return `<div class="chapter-item ${isRead}" onclick="fetchChapter(${idx}); toggleChapterMenu();">${currentMark}${displayName}</div>`;
    }).join('');
}

function markChapterAsRead(index) {
    let readList = JSON.parse(localStorage.getItem('mimi-read') || '{}');
    if (!readList[currentBookId]) readList[currentBookId] = [];
    
    if (!readList[currentBookId].includes(index)) {
        readList[currentBookId].push(index);
        localStorage.setItem('mimi-read', JSON.stringify(readList));
    }
}

// ==========================================
// 導航與主題控制 (Navigation & Theme)
// ==========================================

function setupNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) prevBtn.onclick = () => { if (currentIndex > 0) fetchChapter(currentIndex - 1); };
    if (nextBtn) nextBtn.onclick = () => { if (currentIndex < currentChapters.length - 1) fetchChapter(currentIndex + 1); };
}

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
        light: { blood: '139, 45, 45', curse: '45, 139, 90', ice: '45, 90, 139', undead: '74, 74, 74' },
        dark: { blood: '255, 138, 138', curse: '138, 255, 193', ice: '138, 212, 255', undead: '209, 209, 209' }
    };

    const rgbValue = rgbMatrix[isDark ? 'dark' : 'light'][accentKey];
    document.documentElement.style.setProperty('--accent-rgb', rgbValue);
    
    const colorHex = isDark ? `var(--ice-${accentKey})` : `var(--ink-${accentKey})`;
    document.documentElement.style.setProperty('--current-accent', colorHex);
}

// 暴露給 HTML onClick 調用的全域函數
window.setMode = setMode;
window.setMood = setMood;
window.changeFontSize = changeFontSize;
window.toggleHeart = toggleHeart;
window.toggleChapterMenu = toggleChapterMenu;
window.saveUsername = saveUsername;
