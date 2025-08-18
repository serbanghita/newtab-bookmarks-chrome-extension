import {Settings} from "./Settings";
import {determineFolderNames} from "./utils";
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

type SelectedBookmarkByFolder = {
  folderName: string;
  node: BookmarkTreeNode | null;
};

export class Bookmarks {
  public bookmarks: BookmarkTreeNode[] = [];

  constructor(public settings: Settings) {
    this.settings = settings;
  }

  async init() {
    this.bookmarks = await chrome.bookmarks.getTree();
    return this;
  }

  async add(parentId: string, title: string, url: string) {
    return await chrome.bookmarks.create({parentId, title, url});
  }

  async remove(id: string) {
    return await chrome.bookmarks.remove(id);
  }

  async move(id: string, index: string, parentId: string) {
    return await chrome.bookmarks.move(id, {index: Number(index), parentId});
  }

  async addFolder(parentId: string, title: string) {
    return await chrome.bookmarks.create({parentId, title});
  }

  getSelectedBookmarksByFolder(): SelectedBookmarkByFolder[] | null {
    const rootBookmarkTreeNode = this.bookmarks[0];
    if (typeof rootBookmarkTreeNode === "undefined") {
      return null;
    }

    const rootFolders = determineFolderNames(this.settings.getValue("rootFolderName") || '');

    return rootFolders.map(folderName => {
      return {
        folderName,
        node: Bookmarks.getBookmarksFromFolder(folderName, rootBookmarkTreeNode)
      }
    });
  }

  static getBookmarksFromFolder(folderName: string, treeItem: BookmarkTreeNode): BookmarkTreeNode | null {
    // No folder name set OR folder name is empty.
    if (typeof folderName !== "string" || folderName.trim().length === 0) {
      return null;
    }

    // Found the folder name that the user has requested.
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
        result = Bookmarks.getBookmarksFromFolder(folderName, childTreeNode);
        if (result !== null) {
          return result;
        }
      }
    }

    return null;
  }

  static searchRecursive(query: string, treeItem: chrome.bookmarks.BookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode[] {
    let results: chrome.bookmarks.BookmarkTreeNode[] = [];

    // No valid query.
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
        const result = Bookmarks.searchRecursive(query, childTreeNode);
        if (result !== null) {
          results = results.concat(result)
        }
      }
    }


    return results;
  }

  search(query: string) {
    const rootTreeNode = this.bookmarks[0];
    if (typeof rootTreeNode === "undefined") {
      return [];
    }
    return Bookmarks.searchRecursive(query, rootTreeNode);
  }
}
