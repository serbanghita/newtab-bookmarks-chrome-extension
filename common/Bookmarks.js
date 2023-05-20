class Bookmarks {
    bookmarks = Object.create(null);

    constructor(settings) {
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
        return Bookmarks.getBookmarksFromFolder(this.settings.getValue("rootFolderName"), this.bookmarks[0]);
    }

    static getBookmarksFromFolder(folderName, treeItem) {
        if (typeof folderName !== "string" || folderName.trim().length === 0) {
            return null;
        }
        if (folderName === treeItem.title) {
            return treeItem;
        }

        if (treeItem.children?.length > 0) {
            let result = null;
            for (let i = 0; i<treeItem.children.length; i++) {
                result = Bookmarks.getBookmarksFromFolder(folderName, treeItem.children[i]);
                if (result !== null) {
                    return result;
                }
            }
        }

        return null;
    }

    static searchRecursive(query, treeItem) {
        if (typeof query !== "string" || query.trim().length < 3) {
            return null;
        }

        let results = [];

        if (treeItem.title.toLowerCase().search(query.toLowerCase()) !== -1) {
            results.push(treeItem);
        }

        if (treeItem.children?.length > 0) {
            for (let i = 0; i<treeItem.children.length; i++) {
                let result =  Bookmarks.searchRecursive(query, treeItem.children[i]);
                if (result !== null) {
                    results = results.concat(result)
                }
            }
        }

        return results;
    }

    search(query) {
        return Bookmarks.searchRecursive(query, this.bookmarks[0]);
    }
}