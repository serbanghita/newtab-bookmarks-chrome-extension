"use strict";
(() => {
  // src/Settings.ts
  var Settings = class _Settings {
    constructor() {
      this.settings = /* @__PURE__ */ Object.create(null);
      this.settings = {
        firstRun: true,
        rootFolderName: "",
        bookmarksShowFolderName: "no" /* NO */,
        layout: "rows" /* ROWS */,
        bookmarksWidth: "full-screen",
        bookmarkItemIcon: "yes" /* YES */,
        bookmarkItemSize: "small" /* SMALL */,
        bookmarksShowSubfolders: "no" /* NO */,
        bookmarksReordering: "yes" /* YES */,
        bookmarksSearchBar: "yes" /* YES */,
        theme: "default" /* DEFAULT */
      };
    }
    static {
      this.SETTINGS_ROOT_KEY = "newtab-bookmarks";
    }
    /**
     * Initialize the Local Storage key to keep the settings object.
     */
    async init() {
      const settings = await chrome.storage.local.get(_Settings.SETTINGS_ROOT_KEY) || /* @__PURE__ */ Object.create(null);
      this.settings = { ...this.settings, ...settings[_Settings.SETTINGS_ROOT_KEY] };
      return this;
    }
    isOn(settingName) {
      return this.settings[settingName] === "yes" /* YES */;
    }
    isOff(settingName) {
      const settingValue = this.settings[settingName];
      return !settingValue || settingValue === "no" /* NO */;
    }
    getValue(settingName) {
      return this.settings[settingName];
    }
    setValue(settingName, settingValue) {
      this.settings[settingName] = settingValue;
    }
    async saveOne(key, value) {
      this.setValue(key, value);
      await this.save();
    }
    getAll() {
      return this.settings;
    }
    async save(newSettings) {
      const settingsToSave = newSettings ? { ...this.settings, ...newSettings, firstRun: false } : { ...this.settings, firstRun: false };
      await chrome.storage.local.set({ [_Settings.SETTINGS_ROOT_KEY]: settingsToSave });
      this.settings = settingsToSave;
    }
  };

  // src/utils.ts
  function $(id) {
    return document.getElementById(id);
  }
  function $$q(cssSelector) {
    return document.querySelectorAll(cssSelector);
  }
  function faviconURL(u, imgSize) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", imgSize || "16");
    return url.toString();
  }
  function determineFolderNames(foldersAsString) {
    return foldersAsString.split(",").map((folderName) => folderName.trim()).filter(Boolean);
  }
  function truncateLongText(text) {
    if (text.length > 100 && !text.includes(" ")) {
      return text.substring(0, 60) + " ...";
    }
    return text;
  }

  // src/Bookmarks.ts
  var Bookmarks = class _Bookmarks {
    constructor(settings) {
      this.settings = settings;
      this.bookmarks = [];
      this.settings = settings;
    }
    async init() {
      this.bookmarks = await chrome.bookmarks.getTree();
      return this;
    }
    async add(parentId, title, url) {
      return await chrome.bookmarks.create({ parentId, title, url });
    }
    async remove(id) {
      return await chrome.bookmarks.remove(id);
    }
    async move(id, index, parentId) {
      return await chrome.bookmarks.move(id, { index: Number(index), parentId });
    }
    async addFolder(parentId, title) {
      return await chrome.bookmarks.create({ parentId, title });
    }
    getSelectedBookmarksByFolder() {
      const rootBookmarkTreeNode = this.bookmarks[0];
      if (typeof rootBookmarkTreeNode === "undefined") {
        return null;
      }
      const rootFolders = determineFolderNames(this.settings.getValue("rootFolderName") || "");
      const validFolders = rootFolders.filter((name) => name.length > 0);
      if (validFolders.length === 0) {
        return null;
      }
      const folderMap = _Bookmarks.getBookmarksFromFolders(new Set(validFolders), rootBookmarkTreeNode);
      return validFolders.map((folderName) => ({
        folderName,
        node: folderMap.get(folderName) || null
      }));
    }
    static getBookmarksFromFolders(folderNames, treeItem) {
      if (folderNames.size === 0) return /* @__PURE__ */ new Map();
      const results = /* @__PURE__ */ new Map();
      function traverse(node) {
        if (folderNames.has(node.title) && !results.has(node.title)) {
          results.set(node.title, node);
          if (results.size === folderNames.size) return;
        }
        if (node.children) {
          for (const child of node.children) {
            traverse(child);
            if (results.size === folderNames.size) return;
          }
        }
      }
      traverse(treeItem);
      return results;
    }
    static getBookmarksFromFolder(folderName, treeItem) {
      if (typeof folderName !== "string" || folderName.trim().length === 0) {
        return null;
      }
      if (folderName === treeItem.title) {
        return treeItem;
      }
      const childTreeNodes = treeItem.children;
      if (typeof childTreeNodes === "undefined" || childTreeNodes.length === 0) {
        return null;
      }
      let result = null;
      for (let i = 0; i < childTreeNodes.length; i++) {
        const childTreeNode = childTreeNodes[i];
        if (childTreeNode) {
          result = _Bookmarks.getBookmarksFromFolder(folderName, childTreeNode);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    }
    static searchRecursive(query, treeItem) {
      let results = [];
      if (typeof query !== "string" || query.trim().length < 3) {
        return results;
      }
      if (treeItem.url && treeItem.title.toLowerCase().includes(query.toLowerCase())) {
        results.push(treeItem);
      }
      const childTreeNodes = treeItem.children;
      if (typeof childTreeNodes === "undefined" || childTreeNodes.length === 0) {
        return results;
      }
      for (let i = 0; i < childTreeNodes.length; i++) {
        const childTreeNode = childTreeNodes[i];
        if (childTreeNode) {
          const result = _Bookmarks.searchRecursive(query, childTreeNode);
          if (result !== null) {
            results = results.concat(result);
          }
        }
      }
      return results;
    }
    search(query) {
      const rootTreeNode = this.bookmarks[0];
      if (typeof rootTreeNode === "undefined") {
        return [];
      }
      return _Bookmarks.searchRecursive(query, rootTreeNode);
    }
  };

  // src/View.ts
  var View = class {
    constructor(settings, bookmarks) {
      this.settings = settings;
      this.bookmarks = bookmarks;
    }
    renderBookmark(bookmark, size, isDraggable) {
      const $bookmark = document.createElement("div");
      $bookmark.dataset.index = bookmark.index?.toString();
      $bookmark.dataset.id = bookmark.id;
      $bookmark.dataset.parentId = bookmark.parentId;
      $bookmark.classList.add("bookmark");
      $bookmark.classList.add("flex-item");
      $bookmark.addEventListener("click", () => {
        $bookmark.classList.add("loading");
        setTimeout(() => {
          window.location.href = bookmark.url || "";
        }, 0);
      });
      if (isDraggable) {
        $bookmark.setAttribute("draggable", "true");
        let animationFrame = 0;
        $bookmark.addEventListener("drag", (e) => {
          if (animationFrame) return;
          animationFrame = requestAnimationFrame(() => {
            animationFrame = 0;
            const selectedItem = e.target;
            if (!selectedItem) {
              return;
            }
            const x = e.clientX, y = e.clientY;
            selectedItem.classList.add("drag-sort-active");
            const rawElement = document.elementFromPoint(x, y);
            if (!rawElement) return;
            let swapItem = rawElement.closest(".bookmark");
            if (!swapItem) return;
            const list = selectedItem.parentNode;
            if (!list) {
              return;
            }
            if (swapItem !== selectedItem && list === swapItem.parentNode) {
              swapItem = swapItem !== selectedItem.nextSibling ? swapItem : swapItem.nextSibling;
              list.insertBefore(selectedItem, swapItem);
              selectedItem.dataset.indexSwap = swapItem.dataset.index;
              selectedItem.dataset.parentIdSwap = swapItem.dataset.parentId;
            }
          });
        });
        $bookmark.addEventListener("dragend", async (e) => {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
          }
          const selectedItem = e.target;
          selectedItem.classList.remove("drag-sort-active");
          if (selectedItem.dataset.indexSwap) {
            try {
              await this.bookmarks.move(selectedItem.dataset.id || "", selectedItem.dataset.indexSwap, selectedItem.dataset.parentIdSwap || "");
            } catch (err) {
              console.warn("Failed to reorder bookmark:", err);
            } finally {
              const parent = selectedItem.parentNode;
              if (parent) {
                parent.querySelectorAll(".bookmark").forEach((el, i) => {
                  el.dataset.index = i.toString();
                });
              }
              delete selectedItem.dataset.indexSwap;
              delete selectedItem.dataset.parentIdSwap;
            }
          }
        });
      }
      const $bookmarkImg = document.createElement("img");
      $bookmarkImg.src = faviconURL(bookmark.url || "", size.toString());
      $bookmarkImg.className = "bookmark-icon";
      const $bookmarkLink = document.createElement("div");
      $bookmarkLink.className = "bookmark-link";
      const $bookmarkLinkText = document.createElement("span");
      $bookmarkLinkText.innerText = truncateLongText(bookmark.title);
      $bookmark.appendChild($bookmarkImg);
      $bookmark.appendChild($bookmarkLink).appendChild($bookmarkLinkText);
      return $bookmark;
    }
    async renderSearchBookmarks() {
      const $container = $("bookmarks-search");
      const $searchField = $("bookmarks-search-query");
      const $results = $("bookmarks-search-results");
      const $bookmarks = $("bookmarks");
      if (this.settings.getValue("layout") === "columns" /* COLUMNS */) {
        $bookmarks.classList.add("flex-container-even-columns");
      } else {
        $bookmarks.classList.add("flex-container-rows");
      }
      $container.style.display = "block";
      $searchField.addEventListener("focusin", (e) => {
        e.target.setAttribute("placeholder", "");
      });
      $searchField.addEventListener("focusout", (e) => {
        e.target.setAttribute("placeholder", "Search my bookmarks ...");
      });
      let debounceTimer = 0;
      $searchField.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        $results.replaceChildren();
        $results.style.display = "none";
        $bookmarks.classList.remove("blur");
        debounceTimer = window.setTimeout(() => {
          const query = e.target.value.trim();
          if (!query) {
            return;
          }
          const bookmarksFound = this.bookmarks.search(query);
          if (bookmarksFound && bookmarksFound.length > 0) {
            bookmarksFound.forEach((bookmark) => {
              const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
              const $bookmark = this.renderBookmark(bookmark, size, false);
              $results.appendChild($bookmark);
            });
            $results.style.display = "block";
            $bookmarks.classList.add("blur");
          }
        }, 200);
      });
    }
    async renderStartPageBookmarks() {
      const $bookmarks = $("bookmarks");
      const $wrapper = $("wrapper");
      const selectedBookmarksByFolder = this.bookmarks.getSelectedBookmarksByFolder();
      if (this.settings.getValue("firstRun") || !selectedBookmarksByFolder) {
        const $noBookmarksMsg = $("no-bookmarks-msg");
        $noBookmarksMsg.style.display = "block";
        return;
      }
      const bookmarksWidth = this.settings.getValue("bookmarksWidth");
      const showFolderNames = this.settings.getValue("bookmarksShowFolderName");
      if (bookmarksWidth) {
        $wrapper.classList.add(`bookmarksWidth--${bookmarksWidth}`);
      }
      selectedBookmarksByFolder.forEach((item, index) => {
        const treeNodeChildren = item.node?.children;
        if (!treeNodeChildren) {
          return;
        }
        const $folder = document.createElement("div");
        $folder.classList.add("bookmarks-folder");
        if (showFolderNames === "yes" /* YES */) {
          const $folderTitleContainer = document.createElement("div");
          $folderTitleContainer.classList.add("bookmarks-folder-title");
          $folderTitleContainer.innerText = item.folderName;
          $folder.appendChild($folderTitleContainer);
        }
        const $folderBookMarksContainer = document.createElement("div");
        $folderBookMarksContainer.classList.add("bookmarks-folder-bookmarks");
        $folder.appendChild($folderBookMarksContainer);
        treeNodeChildren.forEach((bookmark) => {
          if (bookmark.children) {
            return;
          }
          const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
          const isDraggable = this.settings.getValue("bookmarksReordering");
          const $bookmark = this.renderBookmark(bookmark, size, isDraggable === "yes" /* YES */);
          $folderBookMarksContainer.appendChild($bookmark);
        });
        $bookmarks.appendChild($folder);
      });
    }
    preRenderSettingsDialog() {
      const $settingsDialog = $("settings-dialog");
      const $settingsLinks = $$q(".settings-link");
      $("settings-root-folder").value = this.settings.getValue("rootFolderName");
      $("settings-bookmark-show-folder-name").value = this.settings.getValue("bookmarksShowFolderName");
      $("settings-layout").value = this.settings.getValue("layout");
      $("settings-bookmarks-width").value = this.settings.getValue("bookmarksWidth");
      $("settings-bookmark-item-icon").value = this.settings.getValue("bookmarkItemIcon");
      $("settings-bookmark-item-size").value = this.settings.getValue("bookmarkItemSize");
      $("settings-show-subfolders").value = this.settings.getValue("bookmarksShowSubfolders");
      $("settings-bookmark-reorder").value = this.settings.getValue("bookmarksReordering");
      $("settings-bookmark-search-bar").value = this.settings.getValue("bookmarksSearchBar");
      $("settings-theme").value = this.settings.getValue("theme");
      $settingsLinks.forEach(($settingsLink) => {
        $settingsLink.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          $settingsDialog.showModal();
        });
      });
      const $saveSettingsBtn = $("settings-save-btn");
      $saveSettingsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.settings.save({
          rootFolderName: $("settings-root-folder").value,
          bookmarksShowFolderName: $("settings-bookmark-show-folder-name").value,
          layout: $("settings-layout").value,
          bookmarksWidth: $("settings-bookmarks-width").value,
          bookmarkItemIcon: $("settings-bookmark-item-icon").value,
          bookmarkItemSize: $("settings-bookmark-item-size").value,
          bookmarksShowSubfolders: $("settings-show-subfolders").value,
          bookmarksReordering: $("settings-bookmark-reorder").value,
          bookmarksSearchBar: $("settings-bookmark-search-bar").value,
          theme: $("settings-theme").value
        }).then(() => {
          $settingsDialog.close();
          window.location.reload();
        });
      });
    }
    // debugSettings() {
    //     $("bookmarks-settings-debug").innerHTML = JSON.stringify(this.settings, null, 2);
    // }
    async render() {
      const theme = this.settings.getValue("theme");
      if (theme && theme !== "default" /* DEFAULT */) {
        document.body.classList.add(`theme--${theme}`);
      }
      if (!this.settings.getValue("firstRun") && this.settings.getValue("bookmarksSearchBar") === "yes") {
        await this.renderSearchBookmarks();
      }
      await this.renderStartPageBookmarks();
      this.preRenderSettingsDialog();
    }
  };

  // src/index.ts
  (async () => {
    const settings = await new Settings().init();
    const bookmarks = await new Bookmarks(settings).init();
    const view = new View(settings, bookmarks);
    await view.render();
  })();
})();
//# sourceMappingURL=newtab.js.map
