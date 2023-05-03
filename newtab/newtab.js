async function getBookmarks() {
    return await chrome.bookmarks.getTree();
}

async function addBookmark(parentId, title, url) {
    return await chrome.bookmarks.create({ parentId, title, url });
}

async function removeBookmark(id) {
    return await chrome.bookmarks.remove(id);
}

async function addFolder(parentId, title) {
    return await chrome.bookmarks.create({ parentId, title });
}

async function getSettings() {
    return await chrome.storage.local.get("newtab-bookmarks");
}

async function saveSettings(key, value) {
    const currentSettings = await getSettings() || {};
    const newSettings = [...currentSettings, {key: value}];

    return await chrome.storage.local.set({"newtab-bookmarks": newSettings});
}

function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "16");
    return url.toString();
}

// Bootstrap.
const bookmarks = await getBookmarks();
const $bookmarks = document.getElementById("bookmarks");

bookmarks[0].children[0].children.forEach((bookmark) => {
    if (bookmark.children) {
        return;
    }

    const $bookmark = document.createElement("div");
    $bookmark.className = "bookmark";

    // Img.
    const $bookmarkImg = document.createElement('img');
    $bookmarkImg.src = faviconURL(bookmark.url);
    $bookmarkImg.className = "bookmark-icon";

    // Link.
    const $bookmarkA = document.createElement("a");
    $bookmarkA.setAttribute("href", bookmark.url);
    $bookmarkA.innerText = bookmark.title;
    $bookmarkA.className = "bookmark-link";

    const $bookmarkLink = document.createElement("div");
    $bookmarkLink.appendChild($bookmarkA);

    $bookmark.appendChild($bookmarkImg);
    $bookmark.appendChild($bookmarkLink);

    $bookmarks.appendChild($bookmark);
});

const settings = await getSettings();
document.getElementById("bookmarks-settings").innerHTML = JSON.stringify(settings);