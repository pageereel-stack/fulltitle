// Settings for the whole site. This is the only block you need to edit.
const SITE = {
  // YouTube video ID (the part after "v=" in the video URL). Leave empty to hide the video.
  VIDEO_ID: "VjYqrZFnRLY",
  // Volume used when a visitor turns the sound on, from 0 to 100.
  VIDEO_VOLUME: 20,
  // Chrome Web Store link of the extension. Leave empty until it is published;
  // the "Add to Chrome" button stays hidden while this is empty.
  STORE_URL: ""
};

const LANGS = {
  am: "አማርኛ", ar: "العربية", bg: "Български", bn: "বাংলা", ca: "Català", cs: "Čeština",
  da: "Dansk", de: "Deutsch", el: "Ελληνικά", en: "English", es: "Español",
  es_419: "Español (Latinoamérica)", et: "Eesti", fa: "فارسی", fi: "Suomi", fil: "Filipino",
  fr: "Français", gu: "ગુજરાતી", he: "עברית", hi: "हिन्दी", hr: "Hrvatski", hu: "Magyar",
  id: "Indonesia", it: "Italiano", ja: "日本語", kn: "ಕನ್ನಡ", ko: "한국어", lt: "Lietuvių",
  lv: "Latviešu", ml: "മലയാളം", mr: "मराठी", ms: "Melayu", nl: "Nederlands", no: "Norsk",
  pl: "Polski", pt_BR: "Português (Brasil)", pt_PT: "Português (Portugal)", ro: "Română",
  ru: "Русский", sk: "Slovenčina", sl: "Slovenščina", sr: "Српски", sv: "Svenska",
  sw: "Kiswahili", ta: "தமிழ்", te: "తెలుగు", th: "ไทย", tr: "Türkçe", uk: "Українська",
  vi: "Tiếng Việt", zh_CN: "简体中文", zh_TW: "繁體中文"
};
const RTL = ["ar", "he", "fa"];
const ALIASES = { nb: "no", nn: "no", iw: "he", tl: "fil", in: "id" };

// Map a browser language tag to one of the languages the site has.
function pickLanguage(tag) {
  if (!tag) return null;
  const [rawBase, region = ""] = String(tag).replace("-", "_").split("_");
  const base = ALIASES[rawBase.toLowerCase()] || rawBase.toLowerCase();
  const full = region ? base + "_" + region.toUpperCase() : base;
  if (LANGS[full]) return full;
  if (base === "zh") return ["TW", "HK", "MO", "HANT"].includes(region.toUpperCase()) ? "zh_TW" : "zh_CN";
  if (base === "pt") return region.toUpperCase() === "PT" ? "pt_PT" : "pt_BR";
  if (base === "es" && region && region.toUpperCase() !== "ES") return "es_419";
  return LANGS[base] ? base : null;
}

function browserLanguage() {
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const tag of list) {
    const code = pickLanguage(tag);
    if (code) return code;
  }
  return "en";
}

const loadMessages = (code) => fetch("locales/" + code + ".json").then((res) => res.json());

let english = null;
async function applyLanguage(code) {
  english = english || (await loadMessages("en"));
  const chosen = code === "en" ? english : await loadMessages(code).catch(() => english);
  const text = (key) => chosen[key] || english[key] || "";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const value = text(el.dataset.i18n);
    if (value) el.textContent = value;
  });
  document.documentElement.lang = code.replace("_", "-");
  document.documentElement.dir = RTL.includes(code) ? "rtl" : "ltr";
  const video = document.querySelector("#player iframe");
  if (video) video.title = text("videoHeading");
}

function storedLanguage() {
  try { return localStorage.getItem("language"); } catch (e) { return null; }
}

// A page can limit its languages with <html data-langs="en,tr">; other pages offer all of them.
const allowed = (document.documentElement.dataset.langs || "").split(",").filter((code) => LANGS[code]);
const offered = allowed.length ? allowed : Object.keys(LANGS);
const usable = (code) => (code && offered.includes(code) ? code : null);

const select = document.getElementById("language");
if (select) {
  offered
    .slice()
    .sort((a, b) => LANGS[a].localeCompare(LANGS[b]))
    .forEach((code) => select.add(new Option(LANGS[code], code)));

  const fromUrl = pickLanguage(new URLSearchParams(location.search).get("lang") || "");
  const initial = usable(fromUrl) || usable(storedLanguage()) || usable(browserLanguage()) || "en";
  select.value = initial;
  applyLanguage(initial);
  select.addEventListener("change", () => {
    try { localStorage.setItem("language", select.value); } catch (e) {}
    applyLanguage(select.value);
  });
}

// "Add to Chrome" buttons appear only once the store link is filled in.
document.querySelectorAll("[data-store-link], [data-store-band]").forEach((el) => {
  if (!SITE.STORE_URL) return;
  if (el.hasAttribute("data-store-link")) el.href = SITE.STORE_URL;
  el.hidden = false;
});

// Video. With data-autoplay on the section it starts muted as soon as the page opens.
const section = document.getElementById("video");
if (section && SITE.VIDEO_ID) {
  const YT = "https://www.youtube.com";
  const id = encodeURIComponent(SITE.VIDEO_ID);
  const autoplay = section.hasAttribute("data-autoplay");
  const player = document.getElementById("player");
  const soundButton = document.getElementById("sound");
  const watchUrl = YT + "/watch?v=" + id;

  const frame = document.createElement("iframe");
  frame.src = YT + "/embed/" + id + "?" + (autoplay ? "autoplay=1&mute=1&" : "") +
    "enablejsapi=1&rel=0&playsinline=1&origin=" + encodeURIComponent(location.origin);
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  player.appendChild(frame);
  document.getElementById("watch-link").href = watchUrl;
  section.hidden = false;

  let ready = false, handshake = null;
  const post = (message) => frame.contentWindow && frame.contentWindow.postMessage(JSON.stringify(message), YT);
  const command = (func, args) => post({ event: "command", func, args: args || [], id: 1, channel: "widget" });

  // If YouTube refuses to play the video here, show a poster that opens it on YouTube instead.
  function showPoster() {
    clearInterval(handshake);
    if (soundButton) soundButton.hidden = true;
    const link = document.createElement("a");
    link.className = "poster"; link.href = watchUrl; link.target = "_blank"; link.rel = "noopener";
    const img = document.createElement("img");
    img.src = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg"; img.alt = "";
    const badge = document.createElement("span");
    badge.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34" fill="#fff" aria-hidden="true"><path d="M8 5.500v13l11-6.500z"/></svg>';
    link.append(img, badge);
    player.replaceChildren(link);
  }

  frame.addEventListener("load", () => {
    handshake = setInterval(() => post({ event: "listening", id: 1, channel: "widget" }), 250);
    setTimeout(() => clearInterval(handshake), 15000);
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== YT || event.source !== frame.contentWindow) return;
    let data;
    try { data = JSON.parse(event.data); } catch (e) { return; }
    if (data.event === "onError") { showPoster(); return; }
    if (!ready && ["onReady", "initialDelivery", "infoDelivery"].includes(data.event)) {
      ready = true;
      clearInterval(handshake);
      command("addEventListener", ["onError"]);
      if (autoplay) {
        // Browsers block autoplay with sound, so the video starts muted.
        command("mute");
        command("playVideo");
        if (soundButton) soundButton.hidden = false;
      }
    }
  });

  if (soundButton) {
    soundButton.addEventListener("click", () => {
      command("unMute");
      command("setVolume", [SITE.VIDEO_VOLUME]);
      command("playVideo");
      soundButton.hidden = true;
    });
  }
}
