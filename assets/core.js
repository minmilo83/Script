// 核心引擎邏輯
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('shelf.html')) {
        loadShelf();
    } else if (path.includes('engine.html')) {
        loadReader();
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
                <h3>${book.id}</h3>
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

    try {
        // 1. 抓取該書的身分證
        const idResponse = await fetch(`library/${bookId}/identity.json`);
        const bookInfo = await idResponse.json();
        document.getElementById('current-book-title').innerText = bookInfo.title;

        // 2. 抓取第一章內容 (暫時先讀取第一筆)
        const firstScript = bookInfo.scripts[0].file;
        const scriptResponse = await fetch(`library/${bookId}/${firstScript}`);
        const htmlContent = await scriptResponse.text();
        
        contentArea.innerHTML = htmlContent;
    } catch (e) {
        contentArea.innerHTML = "讀取書籍內容出錯，請檢查路徑。";
        console.error(e);
    }
}
