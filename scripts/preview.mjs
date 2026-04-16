import { install, resolveBuildId, Browser, BrowserTag, detectBrowserPlatform } from "@puppeteer/browsers";
import { execSync, spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CACHE_DIR = resolve(ROOT, ".chrome-for-testing");
const PROFILE_DIR = resolve(ROOT, ".chrome-dev-profile");

const SEED_DOMAINS = [
  "github.com", "stackoverflow.com", "developer.mozilla.org", "news.ycombinator.com", "reddit.com",
  "wikipedia.org", "medium.com", "dev.to", "css-tricks.com", "smashingmagazine.com",
  "web.dev", "caniuse.com", "npmjs.com", "typescriptlang.org", "nodejs.org",
  "reactjs.org", "vuejs.org", "angular.io", "svelte.dev", "nextjs.org",
  "tailwindcss.com", "getbootstrap.com", "figma.com", "dribbble.com", "codepen.io",
  "jsfiddle.net", "codesandbox.io", "vercel.com", "netlify.com", "cloudflare.com",
  "aws.amazon.com", "cloud.google.com", "azure.microsoft.com", "digitalocean.com", "heroku.com",
  "docker.com", "kubernetes.io", "terraform.io", "ansible.com", "grafana.com",
  "elastic.co", "datadog.com", "sentry.io", "postman.com", "insomnia.rest",
  "jwt.io", "oauth.net", "letsencrypt.org", "cloudflare.com/dns", "namecheap.com",
  "fonts.google.com", "unsplash.com", "pexels.com", "iconify.design", "heroicons.com",
  "eslint.org", "prettier.io", "webpack.js.org", "esbuild.github.io", "vitejs.dev",
  "jestjs.io", "playwright.dev", "cypress.io", "testing-library.com", "storybook.js.org",
  "chromestatus.com", "v8.dev", "tc39.es", "ecma-international.org", "whatwg.org",
  "w3.org", "a11yproject.com", "webaim.org", "axe-core.org", "dequeuniversity.com",
  "regex101.com", "jsonlint.com", "transform.tools", "bundlephobia.com", "packagephobia.com",
  "excalidraw.com", "miro.com", "notion.so", "linear.app", "asana.com",
  "slack.com", "discord.com", "zoom.us", "calendly.com", "loom.com",
  "stripe.com", "twilio.com", "sendgrid.com", "algolia.com", "supabase.com",
  "firebase.google.com", "planetscale.com", "neon.tech", "upstash.com", "redis.io",
];

function seedBookmarks() {
  const defaultDir = resolve(PROFILE_DIR, "Default");
  const bookmarksFile = resolve(defaultDir, "Bookmarks");
  if (existsSync(bookmarksFile)) return;

  const children = SEED_DOMAINS.map((domain, i) => ({
    date_added: String(13370000000000000 + i * 1000000),
    date_last_used: "0",
    id: String(i + 10),
    name: domain.replace(/\..+$/, "").replace(/^www\./, ""),
    type: "url",
    url: `https://${domain}`,
  }));

  const bookmarks = {
    roots: {
      bookmark_bar: {
        children: [
          {
            children,
            date_added: "13370000000000000",
            date_modified: "13370000000000000",
            id: "4",
            name: "test",
            type: "folder",
          },
        ],
        date_added: "0",
        date_modified: "0",
        id: "1",
        name: "Bookmarks bar",
        type: "folder",
      },
      other: { children: [], date_added: "0", date_modified: "0", id: "2", name: "Other bookmarks", type: "folder" },
      synced: { children: [], date_added: "0", date_modified: "0", id: "3", name: "Mobile bookmarks", type: "folder" },
    },
    version: 1,
  };

  mkdirSync(defaultDir, { recursive: true });
  writeFileSync(bookmarksFile, JSON.stringify(bookmarks, null, 2));
  console.log(`[preview] Seeded ${children.length} bookmarks in "test" folder.`);
}

async function main() {
  // 1. Ensure Chrome for Testing is downloaded
  console.log("[preview] Ensuring Chrome for Testing is available...");
  const platform = detectBrowserPlatform();
  const buildId = await resolveBuildId(Browser.CHROME, platform, BrowserTag.STABLE);
  const { executablePath } = await install({
    browser: Browser.CHROME,
    buildId,
    cacheDir: CACHE_DIR,
  });
  console.log(`[preview] Using: ${executablePath}`);

  // 2. Initial build (synchronous — bundle must exist before Chrome loads it)
  console.log("[preview] Building extension...");
  execSync("npx esbuild ./src/index.ts --bundle --outfile=dist/js/newtab.js --sourcemap", {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 3. Start esbuild watch in background
  console.log("[preview] Starting watch mode...");
  const esbuild = spawn("npx", ["esbuild", "./src/index.ts", "--bundle", "--outfile=dist/js/newtab.js", "--sourcemap", "--watch"], {
    cwd: ROOT,
    stdio: "inherit",
  });

  // 4. Seed test bookmarks if profile is fresh
  seedBookmarks();

  // 5. Launch Chrome for Testing with extension auto-loaded
  console.log("[preview] Launching Chrome for Testing...");
  const chromeArgs = [
    `--load-extension=${ROOT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];
  // Ubuntu 23.10+ restricts unprivileged user namespaces via AppArmor, breaking Chrome's sandbox.
  if (process.platform === "linux") chromeArgs.push("--no-sandbox");
  chromeArgs.push("chrome://newtab");
  const chrome = spawn(executablePath, chromeArgs, { stdio: "inherit" });

  // 6. Cleanup on exit
  const cleanup = () => {
    esbuild.kill();
    chrome.kill();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  chrome.on("exit", cleanup);

  console.log("[preview] Ready. Open new tabs (Cmd+T) to see changes after edits.");
}

main().catch((err) => {
  console.error("[preview] Error:", err.message);
  process.exit(1);
});
