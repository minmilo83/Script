/**
 * Script Codex - Core Engine V3.0 (Mimi Private Edition)
 * 核心美學：墨影琉璃、極致沈浸、全玻璃化交互
 */

// --- 全域狀態管理 ---
const CodexState = {
    currentBook: null,
    currentChapters: [],
    currentIndex: 0,
    nickname: localStorage.getItem('codex_nickname') || "",
    favorites: JSON.parse(localStorage.getItem('codex_favorites')) || [],
    fontSize: parseInt(localStorage.getItem('codex_font_size')) || 18,
    isUIHidden: false
};

// --- 初始化啟動器 ---
document.addEventListener('DOMContentLoaded', () => {
    initGlobalEvents();
    
    const path = window.location.pathname;
    if (path.includes('shelf.html') || path.endsWith('/') || path.endsWith('index.html')) {
        initShelf();
    } else if (path.includes('engine.html')) {
        initReader();
    }
});

// --- 1. 全域事件 (Ghost UI & 通用按鈕) ---
function initGlobalEvents() {
    // 捲動時隱藏 UI
    let scrollTimer;
    window.addEventListener('scroll', () => {
        if (!CodexState.isUIHidden) {
            toggleUI(true);
        }
        // 停止捲動後一段時間不自動恢復，必須透過點擊
    }, { passive: true });

    // 點擊畫面顯示 UI
    document.body.addEventListener('click', (e) => {
        // 如果點擊的是按鈕本身則不觸發切換邏輯
        if (e.target.closest('.glass-btn') || e.target.closest('.swatch') || e.target.closest('.glass-input')) return;
        
        if (CodexState.isUIHidden) {
            toggleUI(false);
        }
    });
}

function toggleUI(hide) {
    const uiElements = document.querySelectorAll('.ui-element, .glass-dock, #side-progress-track, .back-btn');
    CodexState.isUIHidden = hide;
    uiElements.forEach(el => {
        if (hide) el.classList.add('ui-hidden');
        else el.classList.remove('ui-hidden');
    });
}

// --- 2. 書架邏輯 (Shelf) ---
async function initShelf() {
    checkNickname();
    const container = document.getElementById('shelf-container');
    const searchInput = document.querySelector('.glass-input');
    
    try {
        const response = await fetch('manifest.json');
        const data = await response.json();
        const books = data.books; // 這裡假設 indexer.js 已排好序

        const renderBooks = (filterText = "") => {
            const filtered = books.filter(b => 
                b.title.includes(filterText) || 
                b.category.includes(filterText) || 
                (b.author && b.author.includes(filterText))
            );

            container.innerHTML = filtered.map(book => {
                const isFav = CodexState.favorites.includes(book.id);
                return `
                <div class="book-card glass-module" onclick="location.href='engine.html?book=${book.id}'">
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <h3 style="margin:0">${book.title}</h3>
                        ${isFav ? '<span style="color:#ff8a8a">♥</span>' : ''}
                    </div>
                    <p style="font-size:0.85rem; opacity:0.7; margin:8px 0">作者：${book.author || '佚名'}</p>
                    <p style="font-size:0.8rem; margin:4px 0">標籤：${book.category}</p>
                    <p style="font-size:0.7rem; opacity:0.5">更新：${book.last_updated || '未知'}</p>
                </div>
            `}).join('');
        };

        // 監聽搜尋
        if (searchInput) {
            searchInput.addEventListener('input', (e) => renderBooks(e.target.value));
        }

        renderBooks();
        updateGreeting();

    } catch (e) {
        console.error("無法載入書架資料", e);
    }
}

// 暱稱檢查與蓋台
function checkNickname() {
    if (!CodexState.nickname) {
        const overlay = document.createElement('div');
        overlay.className = 'full-overlay';
        overlay.innerHTML = `
            <div class="overlay-card glass-module">
                <div class="glass-close" onclick="this.parentElement.parentElement.remove()"></div>
                <h2 style="margin-top:0">歡迎來到墨影琉璃</h2>
                <p>請輸入您的專屬暱稱以開啟旅程</p>
                <input type="text" id="nn-input" class="glass-input" placeholder="您的暱稱..." style="width:80%; margin-bottom:20px">
                <button class="glass-btn" onclick="saveNickname()" style="margin: 0 auto">進入藏書閣</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }
}

function saveNickname() {
    const val = document.getElementById('nn-input').value.trim();
    if (val) {
        localStorage.setItem('codex_nickname', val);
        CodexState.nickname = val;
        location.reload();
    }
}

function updateGreeting() {
    const header = document.getElementById('shelf-header');
    if (!header || !CodexState.nickname) return;
    
    const hour = new Date().getHours();
    let greet = "早安";
    if (hour >= 12 && hour < 18) greet = "午安";
    if (hour >= 18 || hour < 5) greet = "晚安";
    
    const welcomeArea = document.createElement('div');
    welcomeArea.innerHTML = `<h2 style="margin-bottom:0">${CodexState.nickname}，${greet}。</h2>`;
    header.prepend(welcomeArea);
}

// --- 3. 閱讀引擎邏輯 (Reader) ---
async function initReader() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('book');
    const chapterIdx = parseInt(params.get('ch')) || 0;

    if (!bookId) return location.href = 'shelf.html';

    try {
        const response = await fetch(`library/${bookId}/identity.json`);
        const bookData = await bookDataFetch(response, bookId);
        
        CodexState.currentBook = bookData;
        CodexState.currentChapters = bookData.scripts;
        CodexState.currentIndex = chapterIdx;

        loadChapter(chapterIdx);
        initSideProgress();
        updateFavoriteIcon();
    } catch (e) {
        console.error("讀取書籍失敗", e);
    }
}

// 輔助：讀取 identity.json
async function bookDataFetch(res, id) {
    const data = await res.json();
    data.id = id;
    return data;
}

async function loadChapter(idx) {
    const contentArea = document.getElementById('script-content');
    const titleArea = document.getElementById('current-book-title');
    const chapter = CodexState.currentChapters[idx];

    if (!chapter) return;

    try {
        const res = await fetch(`library/${CodexState.currentBook.id}/${chapter.file}`);
        const text = await res.text();
        
        // 更新標題：書名 + 章節數
        const pageTitle = `${CodexState.currentBook.title} - 第 ${idx + 1} 章`;
        document.title = pageTitle;
        if (titleArea) titleArea.innerText = pageTitle;

        contentArea.innerHTML = parseCodexContent(text);
        window.scrollTo(0, 0);
        
        // 更新按鈕狀態
        document.getElementById('prev-btn').disabled = (idx === 0);
        document.getElementById('next-btn').disabled = (idx === CodexState.currentChapters.length - 1);
        
        // 更新章節跳轉事件
        document.getElementById('prev-btn').onclick = () => switchChapter(idx - 1);
        document.getElementById('next-btn').onclick = () => switchChapter(idx + 1);
        
        applyFontSize();
    } catch (e) {
        contentArea.innerHTML = "無法載入章節內容。";
    }
}

function switchChapter(idx) {
    if (idx < 0 || idx >= CodexState.currentChapters.length) return;
    const url = new URL(window.location);
    url.searchParams.set('ch', idx);
    window.history.pushState({}, '', url);
    loadChapter(idx);
}

// --- 4. V3 新版解析引擎 (Regex) ---
function parseCodexContent(text) {
    const lines = text.split('\n');
    let htmlOutput = "";

    lines.forEach(line => {
        let trimmed = line.trim();
        if (!trimmed) {
            htmlOutput += `<br>`;
            return;
        }

        // 系統線處理 (不變動)
        if (trimmed.startsWith('─')) {
            htmlOutput += `<p style="text-align:center; opacity:0.5; font-size:0.9em">${trimmed}</p>`;
            return;
        }

        // V3 新解析邏輯：不允許疊加，由大到小匹配並隱藏符號
        // 1. ***大標題***
        if (/^\*\*\*(.*?)\*\*\*$/.test(trimmed)) {
            trimmed = trimmed.replace(/^\*\*\*(.*?)\*\*\*$/, '<div class="md-h1">$1</div>');
        } 
        // 2. **小標題**
        else if (/^\*\*(.*?)\*\*$/.test(trimmed)) {
            trimmed = trimmed.replace(/^\*\*(.*?)\*\*$/, '<div class="md-h2">$1</div>');
        } 
        // 3. *粗體*
        else if (/\*(.*?)\*/.test(trimmed)) {
            trimmed = trimmed.replace(/\*(.*?)\*/g, '<span class="md-bold">$1</span>');
        }
        
        // 4. //內心獨白// (獨立邏輯，可出現在行中)
        trimmed = trimmed.replace(/\/\/(.*?)\/\//g, '<span class="md-thought">$1</span>');
        
        // 5. /斜體/
        trimmed = trimmed.replace(/\/(.*?)\//g, '<span class="md-italic">$1</span>');

        // 6. 「角色對白」
        trimmed = trimmed.replace(/「(.*?)」/g, '<span class="md-dialogue">「$1」</span>');

        htmlOutput += `<p class="line">${trimmed}</p>`;
    });

    return htmlOutput;
}

// --- 5. 側邊進度條邏輯 ---
function initSideProgress() {
    const track = document.getElementById('side-progress-track');
    const thumb = document.getElementById('side-progress-thumb');
    if (!track || !thumb) return;

    window.addEventListener('scroll', () => {
        const totalHeight = document.body.scrollHeight - window.innerHeight;
        const progress = (window.scrollY / totalHeight) * 100;
        thumb.style.height = `${progress}%`;
    });

    track.addEventListener('click', (e) => {
        const rect = track.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const percentage = clickY / rect.height;
        window.scrollTo({
            top: (document.body.scrollHeight - window.innerHeight) * percentage,
            behavior: 'smooth'
        });
    });
}

// --- 6. 字體與收藏控制 ---
function changeFontSize(delta) {
    CodexState.fontSize += delta;
    if (CodexState.fontSize < 12) CodexState.fontSize = 12;
    if (CodexState.fontSize > 40) CodexState.fontSize = 40;
    
    applyFontSize();
    localStorage.setItem('codex_font_size', CodexState.fontSize);
}

function applyFontSize() {
    const content = document.getElementById('script-content');
    if (content) content.style.fontSize = `${CodexState.fontSize}px`;
}

function toggleFavorite() {
    const id = CodexState.currentBook.id;
    const idx = CodexState.favorites.indexOf(id);
    if (idx > -1) {
        CodexState.favorites.splice(idx, 1);
    } else {
        CodexState.favorites.push(id);
    }
    localStorage.setItem('codex_favorites', JSON.stringify(CodexState.favorites));
    updateFavoriteIcon();
}

function updateFavoriteIcon() {
    const favBtn = document.getElementById('fav-btn');
    if (!favBtn || !CodexState.currentBook) return;
    const isFav = CodexState.favorites.includes(CodexState.currentBook.id);
    favBtn.innerHTML = isFav ? '♥ 已收藏' : '♡ 收藏';
    favBtn.style.color = isFav ? '#ff8a8a' : 'inherit';
}

// --- 7. 主題切換 (繼承原本功能並優化) ---
function setMode(mode) {
    document.body.className = `mode-${mode}`;
    localStorage.setItem('codex_theme_mode', mode);
}

function setMood(mood) {
    const root = document.querySelector(':root');
    const isDark = document.body.classList.contains('mode-black');
    const prefix = isDark ? '--ice-' : '--ink-';
    
    // 更新 CSS 變數
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue(`${prefix}${mood}`);
    const rgbValue = getComputedStyle(document.documentElement).getPropertyValue(`${prefix}rgb-${mood}`);
    
    root.style.setProperty('--current-accent', accentColor);
    root.style.setProperty('--accent-rgb', rgbValue);
}
