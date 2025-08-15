/**
 * Utilities (DOM selectors, etc)
 */
export function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function $q(cssSelector: string) {
  return document.querySelector(cssSelector) as Element;
}

export function $$q(cssSelector: string) {
  return document.querySelectorAll(cssSelector);
}

export function faviconURL(u: string, imgSize: string) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", u);
  url.searchParams.set("size", imgSize || "16");
  return url.toString();
}

