class View {
    constructor(settings, bookmarks) {
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

        $searchField.addEventListener("focusin", (e) => {
            e.target.setAttribute("placeholder", "");
        });
        $searchField.addEventListener("focusout", (e) => {
            e.target.setAttribute("placeholder", "Search my bookmarks ...");
        });

        $searchField.addEventListener("input", async (e) => {
            const query = e.target.value.trim();
            const bookmarksFound = await this.bookmarks.search(query);

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
        startPageBookmarks.children.forEach((bookmark) => {
            if (bookmark.children) {
                return;
            }

            const size = this.settings.getValue("bookmarkItemSize") === "large" ? 32 : 16;
            const isDraggable = this.settings.getValue("bookmarksReordering");
            const $bookmark = this.renderBookmark(bookmark, size, isDraggable);

            $bookmarks.appendChild($bookmark);
        });
    }

    async preRenderSettingsDialog() {
        const $settingsDialog = $("settings-dialog");
        const $settingsLink = $("settings-link");

        // Set form default values from Chrome's "storage".
        $("settings-root-folder").value = this.settings.getValue("rootFolderName");
        $("settings-bookmarks-width").value = this.settings.getValue("bookmarksWidth");
        $("settings-bookmark-item-icon").value = this.settings.getValue("bookmarkItemIcon");
        $("settings-bookmark-item-size").value = this.settings.getValue("bookmarkItemSize");
        $("settings-show-subfolders").value = this.settings.getValue("bookmarksShowSubfolders");
        $("settings-bookmark-reorder").value = this.settings.getValue("bookmarksReordering");
        $("settings-bookmark-search-bar").value = this.settings.getValue("bookmarksSearchBar");

        $settingsLink.addEventListener("click", () => {
            $settingsDialog.showModal();
        });

        const $saveSettingsBtn = $("settings-save-btn");
        $saveSettingsBtn.addEventListener("click", (e) => {
            e.preventDefault();

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
        await this.preRenderSettingsDialog();
        // await debugSettings(settings);
    }

}