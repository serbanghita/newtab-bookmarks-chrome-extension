/**
 * Functions
 */
function $(id) {
    return document.getElementById(id);
}

function $q(cssSelector) {
    return document.querySelector(cssSelector);
}

async function getBookmarks() {
    return await chrome.bookmarks.getTree();
}

async function addBookmark(parentId, title, url) {
    return await chrome.bookmarks.create({ parentId, title, url });
}

async function removeBookmark(id) {
    return await chrome.bookmarks.remove(id);
}

async function moveBookmark(fromId, toId) {
    return await chrome.bookmarks.move(fromId, { index: toId });
}

async function addFolder(parentId, title) {
    return await chrome.bookmarks.create({ parentId, title });
}

async function getSettings() {
    const settings =  await chrome.storage.local.get("newtab-bookmarks");

    return settings["newtab-bookmarks"] || Object.create(null);
}

async function saveSetting(key, value) {
    const currentSettings = await getSettings() || {};
    const newSettings = [...currentSettings, {key: value}];

    return await chrome.storage.local.set({"newtab-bookmarks": newSettings});
}

async function saveSettings(newSettings) {
    return await chrome.storage.local.set({"newtab-bookmarks": newSettings});
}

function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "16");
    return url.toString();
}

function searchBookmarksTree(title, treeItem) {
    if (!title) {
        return null;
    }
    if (title === treeItem.title) {
        return treeItem;
    }

    if (treeItem.children?.length > 0) {
        let result = null;
        for (let i = 0; i<treeItem.children.length; i++) {
            result = searchBookmarksTree(title, treeItem.children[i]);
            if (result !== null) {
                return result;
            }
        }
    }

    return null;
}

async function getBookmarksBySettings() {
    const bookmarks = await getBookmarks();
    const settings = await getSettings();
    return searchBookmarksTree(settings["rootFolderName"], bookmarks[0]);
}

async function renderBookmarks() {
    const bookmarks = await getBookmarksBySettings();
    const $bookmarks = $("bookmarks");

    if (!bookmarks) {
        const $noBookmarksMsg = $("no-bookmarks-msg");
        $noBookmarksMsg.style.display = 'visible';
        return;
    }

    bookmarks.children.forEach((bookmark) => {
        if (bookmark.children) {
            return;
        }

        const $bookmark = document.createElement("div");
        $bookmark.classList.add("bookmark");
        $bookmark.classList.add("flex-item");
        $bookmark.onclick = () => {
            $bookmark.classList.add("loading");
            setTimeout(() => {
                window.location.href = bookmark.url;
            }, 0);

        };

        // Img.
        const $bookmarkImg = document.createElement('img');
        $bookmarkImg.src = faviconURL(bookmark.url);
        $bookmarkImg.className = "bookmark-icon";

        // Link.
        const $bookmarkLink = document.createElement("div");
        $bookmarkLink.innerText = bookmark.title;
        $bookmarkLink.className = "bookmark-link";

        $bookmark.appendChild($bookmarkImg);
        // $bookmark.style.backgroundImage = `url('${faviconURL(bookmark.url)}')`;
        // $bookmark.style.backgroundPosition = 'bottom left 3px';
        // $bookmark.style.backgroundRepeat = 'no-repeat';
        // $bookmark.style.backgroundOrigin = 'border-box'
        $bookmark.appendChild($bookmarkLink);

        $bookmarks.appendChild($bookmark);
    });
}

/**
 * "Add bookmark"
 */
function preRenderAddBookmarkDialog() {
    const $addBookmarkDialog = $("add-bookmark-dialog");
    const $addBookmarkItem = $("add-bookmark-item");
    $addBookmarkItem.addEventListener("click", () => {
        $addBookmarkDialog.showModal();
    });
    const $addBookmarkBtn = $("add-bookmark-btn");
    $addBookmarkBtn.addEventListener("click", (e) => {
        e.preventDefault();

        addBookmark(
            0,
            $("add-bookmark-title").value.trim(),
            $("add-bookmark-url").value.trim()
        ).then(() => {
            $addBookmarkDialog.close();
        });
    });
}

/**
 * "Settings
 */
async function preRenderSettingsDialog() {
    const settings = await getSettings();
    const $settingsDialog = $("settings-dialog");
    const $settingsItem = $("settings-item");

    $("settings-root-folder").value = settings.rootFolderName;
    $(`settings-display-icons-${settings.displayIcons || "no"}`).checked = true;

    $settingsItem.addEventListener("click", () => {
        $settingsDialog.showModal();
    });

    const $saveSettingsBtn = $("settings-save-btn");
    $saveSettingsBtn.addEventListener("click", (e) => {
        e.preventDefault();

        saveSettings({
            rootFolderName: $("settings-root-folder").value,
            displayIcons: $q('input[name="settings-display-icons"]:checked').value
        }).then(() => {
            $settingsDialog.close();
        })
    });
}

async function renderSettingsDebug() {
    const settings = await getSettings();

    $("bookmarks-settings-debug").innerHTML = JSON.stringify(settings);
}

/**
 * Bootstrap
 *
 * "List desired bookmarks"
 */
await renderBookmarks();
// preRenderAddBookmarkDialog();
await preRenderSettingsDialog();
// await renderSettingsDebug();

