/* MrXFuji portfolio — vanilla JS, no tracking, no cookies */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const EMAIL = "ahmedjebali752@gmail.com";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  /* ---------- motion ---------- */
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let motion = store.get("motion") ? store.get("motion") === "on" : !prefersReduced;
  const motionBtn = $("#motionToggle");
  function applyMotion() {
    document.body.classList.toggle("motion-on", motion);
    document.body.classList.toggle("no-motion", !motion);
    motionBtn.textContent = "Motion: " + (motion ? "on" : "off");
    motionBtn.setAttribute("aria-pressed", String(motion));
    $("#fps").textContent = motion ? "RUN" : "STOP";
  }
  motionBtn.addEventListener("click", () => { motion = !motion; store.set("motion", motion ? "on" : "off"); applyMotion(); if (motion) loop(); else drawScope(lastT); });
  applyMotion();

  /* ---------- clock & uptime ---------- */
  const t0 = Date.now();
  $("#year").textContent = new Date().getFullYear();
  function tick() {
    const d = new Date();
    $("#clock").textContent = d.toISOString().slice(11, 19);
    const s = Math.floor((Date.now() - t0) / 1000);
    $("#uptime").textContent = s < 60 ? s + "s" : Math.floor(s / 60) + "m " + (s % 60) + "s";
  }
  tick(); setInterval(tick, 1000);

  /* ---------- boot log ---------- */
  const boot = [
    ["[ 0.000000] ", "ROM: reset vector @ 0x00000004", ""],
    ["[ 0.000412] ", "clk: FRO12M up · core @ 96 MHz", ""],
    ["[ 0.001337] ", "boot: slot A header v1.3 · 48 KiB", ""],
    ["[ 0.004096] ", "boot: sha256(image) …… ", "ok:done"],
    ["[ 0.009001] ", "boot: ecdsa_p256_verify(pubkey) ", "ok:[ VALID ]"],
    ["[ 0.009010] ", "boot: anti-rollback counter 7 ≥ 7 ", "ok:[ OK ]"],
    ["[ 0.009500] ", "jump → app · VTOR=0x0000C000 · MSP set", ""],
    ["[ 0.010000] ", "hello, world. ", "warn:curiosity loaded."]
  ];
  const bootEl = $("#bootlog");
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const lineHTML = ([ts, msg, tail]) => {
    let t = "";
    if (tail) { const [cls, txt] = tail.split(/:(.+)/); t = `<span class="${cls}">${esc(txt)}</span>`; }
    return `<span class="dim">${ts}</span><span class="hl">${esc(msg)}</span>${t}\n`;
  };
  if (!motion) bootEl.innerHTML = boot.map(lineHTML).join("");
  else {
    let i = 0;
    const next = () => {
      if (i >= boot.length) return;
      bootEl.innerHTML += lineHTML(boot[i++]);
      setTimeout(next, i === 4 || i === 5 ? 420 : 170);
    };
    setTimeout(next, 350);
  }

  /* ---------- oscilloscope ---------- */
  const cv = $("#scope"), ctx = cv.getContext("2d");
  let W = 0, H = 0, dpr = 1, lastT = 0, raf = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScope(lastT);
  }
  // SDA bit stream: "MRXFUJI" as ASCII, MSB first, with ACK slots
  const bits = [];
  for (const ch of "MRXFUJI") {
    const c = ch.charCodeAt(0);
    for (let b = 7; b >= 0; b--) bits.push((c >> b) & 1);
    bits.push(0);
  }
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const C1 = css("--ch1"), C2 = css("--ch2"), C3 = css("--ch3");
  function trace(color, fn, y0, amp, width) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const y = y0 - fn(x) * amp;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.stroke(); ctx.shadowBlur = 0;
  }
  function drawScope(t) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    // graticule
    ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
    const gx = W / 10, gy = H / 8;
    for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(i * gx, 0); ctx.lineTo(i * gx, H); ctx.stroke(); }
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, i * gy); ctx.lineTo(W, i * gy); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,255,255,.09)";
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    const shift = t * 0.06;
    const period = 34;
    const edge = (p) => { const f = p - Math.floor(p); return f < 0.06 ? f / 0.06 : f < 0.5 ? 1 : f < 0.56 ? 1 - (f - 0.5) / 0.06 : 0; };
    // CH1: SCL clock
    trace(C1, (x) => edge((x + shift) / period), H * 0.30, H * 0.07, 1.6);
    // CH2: SDA data, changes while SCL low
    trace(C2, (x) => {
      const p = (x + shift) / period - 0.75;
      const k = Math.floor(p), f = p - k;
      const cur = bits[((k % bits.length) + bits.length) % bits.length];
      const prev = bits[(((k - 1) % bits.length) + bits.length) % bits.length];
      return f < 0.08 ? prev + (cur - prev) * (f / 0.08) : cur;
    }, H * 0.52, H * 0.07, 1.6);
    // CH3: supply rail with ripple + wake spikes
    trace(C3, (x) => {
      const u = x + shift * 0.5;
      const spike = Math.exp(-Math.pow(((u % 420) - 60) / 6, 2)) * 1.4;
      return Math.sin(u / 9) * 0.06 + Math.sin(u / 31) * 0.05 - spike;
    }, H * 0.74, H * 0.05, 1.2);
  }
  function loop(t) {
    cancelAnimationFrame(raf);
    const step = (ts) => {
      lastT = ts; drawScope(ts);
      if (motion && !document.hidden) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && motion) loop(); });
  resize();
  if (motion) loop(); else drawScope(1200);

  /* ---------- reveal & active nav ---------- */
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08 });
  $$(".reveal").forEach((el) => io.observe(el));
  const navLinks = $$(".nav a");
  const spy = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  $$("main section[id]").forEach((s) => spy.observe(s));

  /* ---------- register map ---------- */
  const regDesc = $("#regDesc");
  $$(".field").forEach((f) => {
    f.tabIndex = 0;
    const show = () => { regDesc.textContent = `> ${f.closest(".reg-row").querySelector(".reg-name").textContent}.${f.textContent.toUpperCase().replace(/[^A-Z0-9+]+/g, "_")} — ${f.dataset.tip}`; };
    f.addEventListener("mouseenter", show); f.addEventListener("focus", show);
  });

  /* ---------- projects filter ---------- */
  const cards = $$(".card"), chips = $$(".chip"), search = $("#projSearch"), empty = $("#projEmpty");
  let filter = "all";
  chips.forEach((c) => {
    const f = c.dataset.filter;
    c.querySelector("span").textContent = f === "all" ? cards.length : cards.filter((k) => k.dataset.cat.split(" ").includes(f)).length;
    c.addEventListener("click", () => { filter = f; chips.forEach((x) => x.classList.toggle("on", x === c)); applyFilter(); });
  });
  function applyFilter() {
    const q = search.value.trim().toLowerCase();
    let n = 0;
    cards.forEach((k) => {
      const okCat = filter === "all" || k.dataset.cat.split(" ").includes(filter);
      const okQ = !q || (k.textContent + " " + k.dataset.tags).toLowerCase().includes(q);
      k.hidden = !(okCat && okQ); if (!k.hidden) n++;
    });
    empty.hidden = n > 0;
  }
  search.addEventListener("input", applyFilter);
  $("#projReset").addEventListener("click", () => { search.value = ""; chips[0].click(); });
  cards.forEach((k) => k.addEventListener("pointermove", (e) => {
    const r = k.getBoundingClientRect();
    k.style.setProperty("--mx", e.clientX - r.left + "px"); k.style.setProperty("--my", e.clientY - r.top + "px");
  }));

  /* ---------- copy email ---------- */
  async function copyEmail() {
    try { await navigator.clipboard.writeText(EMAIL); return true; } catch { return false; }
  }
  $("#copyEmail").addEventListener("click", async () => {
    const ok = await copyEmail();
    $("#copied").textContent = ok ? `> ${EMAIL} copied to clipboard · ACK` : `> ${EMAIL}`;
  });

  /* ---------- terminal ---------- */
  const out = $("#termOut"), input = $("#termInput"), form = $("#termForm");
  const hist = []; let hi = 0;
  const go = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: motion ? "smooth" : "auto" }); };
  const projList = cards.map((k) => k.querySelector("h3").textContent);
  const cmds = {
    help: () => `available commands:
  whoami        who is behind the firmware
  ls            list sections
  projects      list firmware images
  skills        dump SKILL_CR register
  lab           reverse-engineering challenges
  boot          replay the secure-boot sequence
  contact       how to reach me
  cv            download résumé
  github · linkedin · email
  open &lt;section&gt;  jump to a section
  clear · date · uname -a · history`,
    whoami: () => `Ahmed Salhi (aka MrXFuji). EE student @ ENIT, Tunis.
Embedded systems, firmware security, reverse engineering.
Writes drivers by day, reads disassembly by night.`,
    ls: () => `drwxr-xr-x  whoami/   skills/   firmware/   re-lab/   log/   uart/`,
    projects: () => projList.map((p, i) => `IMG 0x0${i + 1}  ${esc(p)}`).join("\n"),
    skills: () => `SKILL_CR @ 0x4000_F00D
  [EMBEDDED] STM32 MCXA156 Cortex-M FreeRTOS I2C UART GPIO
  [SECURITY] SecureBoot ECDSA mbedTLS Ghidra IDA CTF
  [HARDWARE] KiCad LTspice PCB Scope/LA MATLAB VHDL
  [SOFTWARE] C C++ Python OpenCV MediaPipe pytest Git`,
    lab: () => `5 ELF crackmes: Ouroboros · Architect · Brick Builder · Erika Illusion · Sayeb Salah
→ <a href="https://github.com/ahmedsalhi-code/ReverseEngineeringChallenges" target="_blank" rel="noopener">github.com/ahmedsalhi-code/ReverseEngineeringChallenges</a>`,
    boot: () => boot.map(lineHTML).join("").trim(),
    contact: () => `email     <a href="mailto:${EMAIL}">${EMAIL}</a>
github    <a href="https://github.com/ahmedsalhi-code" target="_blank" rel="noopener">ahmedsalhi-code</a>
linkedin  <a href="https://www.linkedin.com/in/salhi-ahmed-a77a41392/" target="_blank" rel="noopener">salhi-ahmed</a>`,
    cv: () => { const a = document.createElement("a"); a.href = "assets/Salhi_Ahmed_CV.pdf"; a.download = ""; a.click(); return "transferring Salhi_Ahmed_CV.pdf … done."; },
    github: () => { window.open("https://github.com/ahmedsalhi-code", "_blank", "noopener"); return "opening github …"; },
    linkedin: () => { window.open("https://www.linkedin.com/in/salhi-ahmed-a77a41392/", "_blank", "noopener"); return "opening linkedin …"; },
    email: () => { copyEmail(); return `${EMAIL} (copied)`; },
    date: () => new Date().toUTCString(),
    "uname -a": () => "MrXFuji-OS 0.9.3 mcxa156 armv8-m.main Cortex-M33 bare-metal GNU/Curiosity",
    uname: () => "MrXFuji-OS",
    history: () => hist.map((h, i) => `${String(i + 1).padStart(4)}  ${esc(h)}`).join("\n") || "(empty)",
    sudo: () => `<span class="err">mrxfuji is not in the sudoers file. This incident will be reported to the TRNG.</span>`,
    "rm -rf /": () => `<span class="err">nice try. flash is write-protected (FMU locked).</span>`,
    exit: () => "there is no exit. only reset.",
    hello: () => "hello, human. type help.",
    neofetch: () => { go("whoami"); return "see the panel above ↑"; }
  };
  function print(cmd, html, cls = "res") {
    out.insertAdjacentHTML("beforeend", `<div class="cmd"><b>mrxfuji@mcxa156:~$</b> ${esc(cmd)}</div><div class="${cls}">${html}</div>`);
    out.scrollTop = out.scrollHeight;
  }
  function run(raw) {
    const cmd = raw.trim(); if (!cmd) return;
    hist.push(cmd); hi = hist.length;
    const low = cmd.toLowerCase();
    if (low === "clear") { out.innerHTML = ""; return; }
    if (low.startsWith("open ") || low.startsWith("cd ")) {
      const map = { whoami: "whoami", skills: "skills", firmware: "projects", projects: "projects", "re-lab": "lab", lab: "lab", log: "log", uart: "contact", contact: "contact" };
      const t = map[low.split(/\s+/)[1]?.replace(/[~/]/g, "")];
      if (t) { go(t); print(cmd, `→ ${t}`); } else print(cmd, `no such section. try: ls`, "err");
      return;
    }
    if (low.startsWith("echo ")) { print(cmd, esc(cmd.slice(5))); return; }
    if (low.startsWith("sudo")) { print(cmd, cmds.sudo()); return; }
    const f = cmds[low];
    if (f) print(cmd, f());
    else print(cmd, `${esc(cmd.split(" ")[0])}: command not found. type <b>help</b>`, "err");
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); run(input.value); input.value = ""; });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && hi > 0) { input.value = hist[--hi]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ""; e.preventDefault(); }
    else if (e.key === "Tab") {
      e.preventDefault();
      const m = Object.keys(cmds).concat(["clear", "open "]).filter((c) => c.startsWith(input.value.toLowerCase()));
      if (m.length === 1) input.value = m[0];
      else if (m.length > 1 && input.value) print(input.value, m.join("   "));
    }
  });
  out.innerHTML = `<div class="res">MrXFuji-OS 0.9.3 (ttyACM0) · secure boot: <span style="color:var(--ch1)">VERIFIED</span>
type <b style="color:var(--ch1)">help</b> to look around.</div>`;
  $("#term").addEventListener("click", (e) => { if (!e.target.closest("a")) input.focus({ preventScroll: true }); });

  /* ---------- command palette ---------- */
  const overlay = $("#overlay"), palIn = $("#palInput"), palList = $("#palList"), palCount = $("#palCount");
  const items = [
    { t: "whoami", k: "section", a: () => go("whoami") },
    { t: "Register map — skills", k: "section", a: () => go("skills") },
    { t: "Firmware images — projects", k: "section", a: () => go("projects") },
    { t: "RE lab — crackmes", k: "section", a: () => go("lab") },
    { t: "System log — experience", k: "section", a: () => go("log") },
    { t: "UART — contact", k: "section", a: () => go("contact") },
    ...cards.map((k) => ({ t: k.querySelector("h3").textContent, k: k.querySelector(".img-id").textContent, s: k.dataset.tags, a: () => { go("projects"); const d = k.querySelector("details"); setTimeout(() => { d.open = true; k.scrollIntoView({ behavior: motion ? "smooth" : "auto", block: "center" }); }, 50); } })),
    ...$$(".bin:not(.bin-all)").map((b) => ({ t: b.querySelector(".bin-name").textContent + " (crackme)", k: "re-lab", s: "reverse elf ghidra", a: () => window.open(b.href, "_blank", "noopener") })),
    { t: "Download CV", k: "action", s: "resume pdf", a: () => cmds.cv() },
    { t: "Copy email", k: "action", s: "contact mail", a: () => copyEmail() },
    { t: "Open GitHub", k: "link", a: () => cmds.github() },
    { t: "Open LinkedIn", k: "link", a: () => cmds.linkedin() },
    { t: "Toggle motion", k: "action", s: "animation reduce", a: () => motionBtn.click() },
    { t: "Open terminal", k: "action", s: "shell console uart", a: () => { go("whoami"); setTimeout(() => input.focus({ preventScroll: true }), 500); } }
  ];
  let shown = [], sel = 0, lastFocus = null;
  function renderPal() {
    const q = palIn.value.trim().toLowerCase();
    shown = items.filter((i) => !q || (i.t + " " + i.k + " " + (i.s || "")).toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    palList.innerHTML = shown.length
      ? shown.map((i, n) => `<li role="option" data-n="${n}" class="${n === sel ? "sel" : ""}" aria-selected="${n === sel}"><span>${esc(i.t)}</span><small>${esc(i.k)}</small></li>`).join("")
      : `<li class="none">0x00000000 · no address matches “${esc(q)}”</li>`;
    palCount.textContent = shown.length + " addresses";
    palList.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
  }
  function openPal() { lastFocus = document.activeElement; overlay.hidden = false; palIn.value = ""; sel = 0; renderPal(); palIn.focus(); }
  function closePal() { overlay.hidden = true; lastFocus?.focus?.({ preventScroll: true }); }
  function choose(n) { const i = shown[n]; if (!i) return; closePal(); i.a(); }
  $("#openSearch").addEventListener("click", openPal);
  palIn.addEventListener("input", () => { sel = 0; renderPal(); });
  palList.addEventListener("click", (e) => { const li = e.target.closest("li[data-n]"); if (li) choose(+li.dataset.n); });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePal(); });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); overlay.hidden ? openPal() : closePal(); return; }
    if (e.key === "/" && overlay.hidden && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openPal(); return; }
    if (overlay.hidden) return;
    if (e.key === "Escape") closePal();
    else if (e.key === "ArrowDown") { sel = Math.min(shown.length - 1, sel + 1); renderPal(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); renderPal(); e.preventDefault(); }
    else if (e.key === "Enter") { choose(sel); e.preventDefault(); }
  });

  /* ---------- console easter egg ---------- */
  console.log("%c./mrxfuji_", "color:#3cf2b8;font:700 28px monospace");
  console.log("%cYou opened the console. You're my kind of person. → " + EMAIL, "color:#ffb547;font:12px monospace");
})();
