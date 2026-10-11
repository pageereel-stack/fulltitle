// Settings. This is the only block you need to edit.
const SITE = {
  // YouTube video ID (the part after "v=" in the video URL). Leave empty to hide the video.
  VIDEO_ID: "VjYqrZFnRLY",
  // Volume used when a visitor turns the sound on, from 0 to 100.
  VIDEO_VOLUME: 20
};

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
