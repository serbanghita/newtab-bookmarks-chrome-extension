import {Settings} from "./Settings";
import {Bookmarks} from "./Bookmarks";
import {$, $$q, faviconURL} from "./utils";

export class View {
  constructor(private settings: Settings, private bookmarks: Bookmarks) {
    this.settings = settings;
    this.bookmarks = bookmarks;
  }

  renderBookmark(bookmark, size, isDraggable) {
    const $bookmark = document.createElement("div");
    // Keep "id" for later sorting operations.
    $bookmark.dataset.index = bookmark.index;
    $bookmark.dataset.id = bookmark.id;
    $bookmark.dataset.parentId = bookmark.parentId;

    $bookmark.classList.add("bookmark");
    $bookmark.classList.add("flex-item");
    $bookmark.addEventListener("click", () => {
      $bookmark.classList.add("loading");
      setTimeout(() => {
        window.location.href = bookmark.url;
      }, 0);

    });

    // Handle drag
    if (isDraggable) {
      $bookmark.setAttribute("draggable", true);
      $bookmark.addEventListener("drag", (e) => {
        const selectedItem = e.target;
        const list = selectedItem.parentNode;
        const x = e.clientX, y = e.clientY;

        selectedItem.classList.add('drag-sort-active');
        let swapItem = document.elementFromPoint(x, y) === null ? selectedItem : document.elementFromPoint(x, y);

        if (swapItem !== selectedItem && list === swapItem.parentNode) {
          swapItem = swapItem !== selectedItem.nextSibling ? swapItem : swapItem.nextSibling;
          list.insertBefore(selectedItem, swapItem);
          selectedItem.dataset.indexSwap = swapItem.dataset.index;
          selectedItem.dataset.parentIdSwap = swapItem.dataset.parentId;
          // console.log(selectedItem.innerText, swapItem.innerText);
        }
      });
      $bookmark.addEventListener("dragend", (e) => {
        e.target.classList.remove('drag-sort-active');
        // Re-order in Chrome.
        this.bookmarks.move(e.target.dataset.id, e.target.dataset.indexSwap, e.target.dataset.parentIdSwap);
        delete e.target.dataset.indexSwap;
        delete e.target.dataset.parentIdSwap;
      });
    }

    // Img.
    const $bookmarkImg = document.createElement('img');
    $bookmarkImg.src = faviconURL(bookmark.url, size);
    $bookmarkImg.className = "bookmark-icon";

    // Link.
    const $bookmarkLink = document.createElement("div");
    $bookmarkLink.innerText = bookmark.title;
    $bookmarkLink.className = "bookmark-link";

    $bookmark.appendChild($bookmarkImg);
    $bookmark.appendChild($bookmarkLink);

    return $bookmark;
  }

  async renderSearchBookmarks() {
    const $container = $("bookmarks-search");
    // const $form = $("bookmarks-search-form");
    const $searchField = $("bookmarks-search-query");
    const $results = $("bookmarks-search-results");
    const $bookmarks = $("bookmarks");

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
    const startPageBookmarks = this.bookmarks.getStartPageBookmarks();

    if (this.settings.getValue("firstRun") || !startPageBookmarks) {
      const $noBookmarksMsg = $("no-bookmarks-msg");
      $noBookmarksMsg.style.display = 'block';
      return;
    }

    // Set CSS settings to the main wrapper (so we can paint conditionally later with CSS).
    for (const settingName in this.settings.getAll()) {
      $wrapper.classList.add(`${settingName}--${this.settings.getValue(settingName)}`);
    }

    // Render bookmarks items.
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
      const $bookmark = this.renderBookmark(bookmark, size, isDraggable);

      $bookmarks.appendChild($bookmark);
    });
  }

  preRenderSettingsDialog() {
    const $settingsDialog = $<HTMLDialogElement>("settings-dialog");
    const $settingsLinks = $$q(".settings-link");

    // Set form default values from Chrome's "storage".
    $<HTMLInputElement>("settings-root-folder").value = this.settings.getValue("rootFolderName");
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
        bookmarksWidth: $<HTMLInputElement>("settings-bookmarks-width").value,
        bookmarkItemIcon: $<HTMLInputElement>("settings-bookmark-item-icon").value,
        bookmarkItemSize: $<HTMLInputElement>("settings-bookmark-item-size").value,
        bookmarksShowSubfolders: $<HTMLInputElement>("settings-show-subfolders").value,
        bookmarksReordering: $<HTMLInputElement>("settings-bookmark-reorder").value,
        bookmarksSearchBar: $<HTMLInputElement>("settings-bookmark-search-bar").value
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
