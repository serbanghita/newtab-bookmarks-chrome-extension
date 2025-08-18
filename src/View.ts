import {BooleanSetting, LayoutSetting, Settings, SizeSetting} from "./Settings";
import {Bookmarks} from "./Bookmarks";
import {$, $$q, faviconURL, truncateLongText} from "./utils";
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export class View {
  constructor(private settings: Settings, private bookmarks: Bookmarks) {
  }

  renderBookmark(bookmark: BookmarkTreeNode, size: number, isDraggable: boolean) {
    const $bookmark = document.createElement("div");
    // Keep "id" for later sorting operations.
    $bookmark.dataset.index = bookmark.index?.toString();
    $bookmark.dataset.id = bookmark.id;
    $bookmark.dataset.parentId = bookmark.parentId;

    $bookmark.classList.add("bookmark");
    $bookmark.classList.add("flex-item");
    $bookmark.addEventListener("click", () => {
      $bookmark.classList.add("loading");
      setTimeout(() => {
        window.location.href = bookmark.url || '';
      }, 0);

    });

    // Handle drag
    if (isDraggable) {
      $bookmark.setAttribute("draggable", "true");
      $bookmark.addEventListener("drag", (e: DragEvent) => {
        const selectedItem = e.target as HTMLElement;
        if (!selectedItem) {
          return;
        }

        const x = e.clientX, y = e.clientY;

        selectedItem.classList.add('drag-sort-active');
        let swapItem = (document.elementFromPoint(x, y) === null ? selectedItem : document.elementFromPoint(x, y)) as HTMLElement;
        const list = selectedItem.parentNode;

        if (!swapItem || !list) {
          return;
        }

        if (swapItem !== selectedItem && list === swapItem.parentNode) {
          swapItem = swapItem !== selectedItem.nextSibling as HTMLElement ? swapItem : swapItem.nextSibling as HTMLElement;
          list.insertBefore(selectedItem, swapItem);
          selectedItem.dataset.indexSwap = swapItem.dataset.index;
          selectedItem.dataset.parentIdSwap = swapItem.dataset.parentId;
          // console.log(selectedItem.innerText, swapItem.innerText);
        }
      });
      $bookmark.addEventListener("dragend", (e) => {
        const selectedItem = e.target as HTMLElement;
        selectedItem.classList.remove('drag-sort-active');
        // Re-order in Chrome.
        this.bookmarks.move(selectedItem.dataset.id || '', selectedItem.dataset.indexSwap || '', selectedItem.dataset.parentIdSwap || '');
        delete selectedItem.dataset.indexSwap;
        delete selectedItem.dataset.parentIdSwap;
      });
    }

    // Img.
    const $bookmarkImg = document.createElement('img');
    $bookmarkImg.src = faviconURL(bookmark.url || '', size.toString());
    $bookmarkImg.className = "bookmark-icon";

    // Link.
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
    // const $form = $("bookmarks-search-form");
    const $searchField = $("bookmarks-search-query");
    const $results = $("bookmarks-search-results");
    const $bookmarks = $("bookmarks");

    if (this.settings.getValue("layout") === LayoutSetting.COLUMNS) {
      $bookmarks.classList.add("flex-container-even-columns");
    } else {
      $bookmarks.classList.add("flex-container-rows");
    }

    $container.style.display = 'block';

    $searchField.addEventListener("focusin", (e: Event) => {
      (e.target as HTMLInputElement).setAttribute("placeholder", "");
    });
    $searchField.addEventListener("focusout", (e: Event) => {
      (e.target as HTMLInputElement).setAttribute("placeholder", "Search my bookmarks ...");
    });

    $searchField.addEventListener("input", (e: Event) => {
      const query = (e.target as HTMLInputElement).value.trim();
      const bookmarksFound = this.bookmarks.search(query);

      $results.innerHTML = '';
      $bookmarks.classList.remove("blur");

      if (bookmarksFound && bookmarksFound.length > 0) {
        bookmarksFound.forEach((bookmark) => {
          const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
          const $bookmark = this.renderBookmark(bookmark, size, false);
          $results.appendChild($bookmark);
        });

        $results.style.display = 'block';
        $bookmarks.classList.add("blur");
      }
    });
  }

  async renderStartPageBookmarks() {
    const $bookmarks = $("bookmarks");
    const $wrapper = $("wrapper");
    const selectedBookmarksByFolder = this.bookmarks.getSelectedBookmarksByFolder();

    if (this.settings.getValue("firstRun") || !selectedBookmarksByFolder) {
      const $noBookmarksMsg = $("no-bookmarks-msg");
      $noBookmarksMsg.style.display = 'block';
      return;
    }

    const bookmarksWidth = this.settings.getValue("bookmarksWidth");
    const showFolderNames = this.settings.getValue("bookmarksShowFolderName");

    if (bookmarksWidth) {
      $wrapper.classList.add(`bookmarksWidth--${bookmarksWidth}`);
    }

    // Set CSS settings to the main wrapper (so we can paint conditionally later with CSS).
    // for (const settingName in this.settings.getAll()) {
    //   $wrapper.classList.add(`${settingName}--${this.settings.getValue(settingName as keyof SettingsProps)}`);
    // }

    // Render bookmarks items.
    selectedBookmarksByFolder.forEach((item, index) => {
      const treeNodeChildren = item.node?.children;
      if (!treeNodeChildren) {
        return;
      }

      // Create the "folder" node that contains all bookmarks.
      const $folder = document.createElement("div");
      $folder.classList.add("bookmarks-folder");

      if (showFolderNames === BooleanSetting.YES) {
        const $folderTitleContainer = document.createElement("div");
        $folderTitleContainer.classList.add("bookmarks-folder-title");
        $folderTitleContainer.innerText = item.folderName;
        $folder.appendChild($folderTitleContainer);
      }

      const $folderBookMarksContainer = document.createElement("div");
      $folderBookMarksContainer.classList.add("bookmarks-folder-bookmarks");

      $folder.appendChild($folderBookMarksContainer);

      treeNodeChildren.forEach((bookmark) => {
        // Subfolder, skip.
        if (bookmark.children) {
          return;
        }

        const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
        const isDraggable = this.settings.getValue("bookmarksReordering");
        const $bookmark = this.renderBookmark(bookmark, size, isDraggable === BooleanSetting.YES);

        $folderBookMarksContainer.appendChild($bookmark);
      });

      $bookmarks.appendChild($folder);
    });
  }

  preRenderSettingsDialog() {
    const $settingsDialog = $<HTMLDialogElement>("settings-dialog");
    const $settingsLinks = $$q(".settings-link");

    // Set form default values from Chrome's "storage".
    $<HTMLInputElement>("settings-root-folder").value = this.settings.getValue("rootFolderName");
    $<HTMLInputElement>("settings-bookmark-show-folder-name").value = this.settings.getValue("bookmarksShowFolderName");
    $<HTMLInputElement>("settings-layout").value = this.settings.getValue("layout");
    $<HTMLInputElement>("settings-bookmarks-width").value = this.settings.getValue("bookmarksWidth");
    $<HTMLInputElement>("settings-bookmark-item-icon").value = this.settings.getValue("bookmarkItemIcon");
    $<HTMLInputElement>("settings-bookmark-item-size").value = this.settings.getValue("bookmarkItemSize");
    $<HTMLInputElement>("settings-show-subfolders").value = this.settings.getValue("bookmarksShowSubfolders");
    $<HTMLInputElement>("settings-bookmark-reorder").value = this.settings.getValue("bookmarksReordering");
    $<HTMLInputElement>("settings-bookmark-search-bar").value = this.settings.getValue("bookmarksSearchBar");

    $settingsLinks.forEach(($settingsLink) => {
      $settingsLink.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        $settingsDialog.showModal();
      });
    })


    const $saveSettingsBtn = $("settings-save-btn");
    $saveSettingsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      this.settings.save({
        rootFolderName: $<HTMLInputElement>("settings-root-folder").value,
        bookmarksShowFolderName: $<HTMLInputElement>("settings-bookmark-show-folder-name").value as BooleanSetting,
        layout: $<HTMLInputElement>("settings-layout").value as LayoutSetting,
        bookmarksWidth: $<HTMLInputElement>("settings-bookmarks-width").value,
        bookmarkItemIcon: $<HTMLInputElement>("settings-bookmark-item-icon").value as BooleanSetting,
        bookmarkItemSize: $<HTMLInputElement>("settings-bookmark-item-size").value as SizeSetting,
        bookmarksShowSubfolders: $<HTMLInputElement>("settings-show-subfolders").value as BooleanSetting,
        bookmarksReordering: $<HTMLInputElement>("settings-bookmark-reorder").value as BooleanSetting,
        bookmarksSearchBar: $<HTMLInputElement>("settings-bookmark-search-bar").value as BooleanSetting,
      }).then(() => {
        $settingsDialog.close();
        window.location.reload();
      })
    });
  }

  // debugSettings() {
  //     $("bookmarks-settings-debug").innerHTML = JSON.stringify(this.settings, null, 2);
  // }

  async render() {
    // Bookmarks search bar.
    if (
      !this.settings.getValue("firstRun") &&
      this.settings.getValue("bookmarksSearchBar") === 'yes'
    ) {
      await this.renderSearchBookmarks();
    }
    // Start Page bookmarks.
    await this.renderStartPageBookmarks();
    // Hidden "Settings" dialog.
    this.preRenderSettingsDialog();
    // await debugSettings(settings);
  }

}
