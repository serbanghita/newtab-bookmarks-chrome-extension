/**
 * Functions
 */
function $(id) {
    return document.getElementById(id);
}

function $q(cssSelector) {
    return document.querySelector(cssSelector);
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

