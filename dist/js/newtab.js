"use strict";
(() => {
  // src/Settings.ts
  var Settings = class _Settings {
    constructor() {
      this.settings = /* @__PURE__ */ Object.create(null);
      this.settings = {
        firstRun: true,
        rootFolderName: "",
        bookmarksWidth: "full-screen",
        bookmarkItemIcon: "yes" /* YES */,
        bookmarkItemSize: "small" /* SMALL */,
        bookmarksShowSubfolders: "no" /* NO */,
        bookmarksReordering: "yes" /* YES */,
        bookmarksSearchBar: "yes" /* YES */
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
      if (newSettings) {
        await chrome.storage.local.set({ [_Settings.SETTINGS_ROOT_KEY]: { ...this.settings, ...newSettings, ...{ firstRun: false } } });
      } else {
        await chrome.storage.local.set({ [_Settings.SETTINGS_ROOT_KEY]: { ...this.settings } });
      }
    }
  };

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
    getStartPageBookmarks() {
      const rootFolderName = this.settings.getValue("rootFolderName");
      const rootBookmarkTreeNode = this.bookmarks[0];
      if (typeof rootBookmarkTreeNode === "undefined") {
        return null;
      }
      return _Bookmarks.getBookmarksFromFolder(rootFolderName, rootBookmarkTreeNode);
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
      if (treeItem.title.toLowerCase().search(query.toLowerCase()) !== -1) {
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
        $bookmark.addEventListener("drag", (e) => {
          const selectedItem = e.target;
          if (!selectedItem) {
            return;
          }
          const x = e.clientX, y = e.clientY;
          selectedItem.classList.add("drag-sort-active");
          let swapItem = document.elementFromPoint(x, y) === null ? selectedItem : document.elementFromPoint(x, y);
          const list = selectedItem.parentNode;
          if (!swapItem || !list) {
            return;
          }
          if (swapItem !== selectedItem && list === swapItem.parentNode) {
            swapItem = swapItem !== selectedItem.nextSibling ? swapItem : swapItem.nextSibling;
            list.insertBefore(selectedItem, swapItem);
            selectedItem.dataset.indexSwap = swapItem.dataset.index;
            selectedItem.dataset.parentIdSwap = swapItem.dataset.parentId;
          }
        });
        $bookmark.addEventListener("dragend", (e) => {
          const selectedItem = e.target;
          selectedItem.classList.remove("drag-sort-active");
          this.bookmarks.move(selectedItem.dataset.id || "", selectedItem.dataset.indexSwap || "", selectedItem.dataset.parentIdSwap || "");
          delete selectedItem.dataset.indexSwap;
          delete selectedItem.dataset.parentIdSwap;
        });
      }
      const $bookmarkImg = document.createElement("img");
      $bookmarkImg.src = faviconURL(bookmark.url || "", size.toString());
      $bookmarkImg.className = "bookmark-icon";
      const $bookmarkLink = document.createElement("div");
      $bookmarkLink.innerText = bookmark.title;
      $bookmarkLink.className = "bookmark-link";
      $bookmark.appendChild($bookmarkImg);
      $bookmark.appendChild($bookmarkLink);
      return $bookmark;
    }
    async renderSearchBookmarks() {
      const $container = $("bookmarks-search");
      const $searchField = $("bookmarks-search-query");
      const $results = $("bookmarks-search-results");
      const $bookmarks = $("bookmarks");
      $container.style.display = "block";
      $searchField.addEventListener("focusin", (e) => {
        e.target.setAttribute("placeholder", "");
      });
      $searchField.addEventListener("focusout", (e) => {
        e.target.setAttribute("placeholder", "Search my bookmarks ...");
      });
      $searchField.addEventListener("input", (e) => {
        const query = e.target.value.trim();
        const bookmarksFound = this.bookmarks.search(query);
        $results.innerHTML = "";
        $bookmarks.classList.remove("blur");
        if (bookmarksFound && bookmarksFound.length > 0) {
          bookmarksFound.forEach((bookmark) => {
            const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
            const $bookmark = this.renderBookmark(bookmark, size, false);
            $results.appendChild($bookmark);
          });
          $results.style.display = "block";
          $bookmarks.classList.add("blur");
        }
      });
    }
    async renderStartPageBookmarks() {
      const $bookmarks = $("bookmarks");
      const $wrapper = $("wrapper");
      const startPageBookmarks = this.bookmarks.getStartPageBookmarks();
      if (this.settings.getValue("firstRun") || !startPageBookmarks) {
        const $noBookmarksMsg = $("no-bookmarks-msg");
        $noBookmarksMsg.style.display = "block";
        return;
      }
      for (const settingName in this.settings.getAll()) {
        $wrapper.classList.add(`${settingName}--${this.settings.getValue(settingName)}`);
      }
      const treeNodeChildren = startPageBookmarks.children;
      if (!treeNodeChildren) {
        return;
      }
      treeNodeChildren.forEach((bookmark) => {
        if (bookmark.children) {
          return;
        }
        const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
        const isDraggable = this.settings.getValue("bookmarksReordering");
        const $bookmark = this.renderBookmark(bookmark, size, isDraggable === "yes" /* YES */);
        $bookmarks.appendChild($bookmark);
      });
    }
    preRenderSettingsDialog() {
      const $settingsDialog = $("settings-dialog");
      const $settingsLinks = $$q(".settings-link");
      $("settings-root-folder").value = this.settings.getValue("rootFolderName");
      $("settings-bookmarks-width").value = this.settings.getValue("bookmarksWidth");
      $("settings-bookmark-item-icon").value = this.settings.getValue("bookmarkItemIcon");
      $("settings-bookmark-item-size").value = this.settings.getValue("bookmarkItemSize");
      $("settings-show-subfolders").value = this.settings.getValue("bookmarksShowSubfolders");
      $("settings-bookmark-reorder").value = this.settings.getValue("bookmarksReordering");
      $("settings-bookmark-search-bar").value = this.settings.getValue("bookmarksSearchBar");
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
          bookmarksWidth: $("settings-bookmarks-width").value,
          bookmarkItemIcon: $("settings-bookmark-item-icon").value,
          bookmarkItemSize: $("settings-bookmark-item-size").value,
          bookmarksShowSubfolders: $("settings-show-subfolders").value,
          bookmarksReordering: $("settings-bookmark-reorder").value,
          bookmarksSearchBar: $("settings-bookmark-search-bar").value
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
