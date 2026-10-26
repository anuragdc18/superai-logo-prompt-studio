(function () {
  const $ = (id) => document.getElementById(id);
  const T = window.TPL;
  const DEFAULT_MODEL = "claude-sonnet-4-5";
  const IDLE_LOCK_MS = 30 * 60 * 1000;
  const roles = ["dark", "main", "accent"];
  let logo = null; // { pngDataUrl }
  let picked = null; // swatch hex chosen for assigning
  let last = null; // last result { template, items, mood, tips, names }

  /** "opus 5.5", "Claude Sonnet 4.5", "claude_opus_5.5" -> "claude-opus-5-5" */
  function normalizeModel(v) {
    let m = String(v || "").trim().toLowerCase().replace(/[\s_.]+/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
    if (!m) return DEFAULT_MODEL;
    if (/^(opus|sonnet|haiku|fable|mythos)-/.test(m)) m = "claude-" + m;
    return m;
  }
  const PRESETS = ["claude-sonnet-4-5", "claude-opus-5-5"];

  const settings = {
    get model() { try { return normalizeModel(localStorage.getItem("lps_model") || DEFAULT_MODEL); } catch { return DEFAULT_MODEL; } },
    set model(v) { try { localStorage.setItem("lps_model", normalizeModel(v)); } catch {} },
  };

  // ---------- templates ----------
  T.templates.forEach((t, i) => $("tpl").add(new Option(t.label, i)));
  const tpl = () => T.templates[+$("tpl").value];

  // ---------- colours ----------
  const color = (r) => $(`h-${r}`).value.toUpperCase();
  const validHex = (v) => /^#[0-9A-F]{6}$/i.test(v);
  function setColor(r, hex) {
    hex = hex.toUpperCase();
    $(`c-${r}`).value = hex;
    $(`h-${r}`).value = hex;
    refreshColors();
  }
  function refreshColors() {
    const c = Object.fromEntries(roles.map((r) => [r, color(r)]));
    roles.forEach((r) => ($(`n-${r}`).textContent = Colors.nameOf(c[r])));
    const m = $("mock").style;
    m.setProperty("--d", c.dark); m.setProperty("--m", c.main); m.setProperty("--a", c.accent);
    $("adminCodes").textContent = `Navy ${c.dark} · Royal ${c.main} · Brand ${c.accent}`;
    const notes = [];
    if (Colors.contrast(c.accent, "#FFFFFF") < 3) notes.push("White text on the accent colour is hard to read — buttons may need a darker accent.");
    if (Colors.contrast(c.dark, "#FFFFFF") < 4.5) notes.push("The dark colour is quite light — header/footer text may be hard to read.");
    $("contrastNote").hidden = !notes.length;
    $("contrastNote").textContent = notes.join(" ");
  }
  roles.forEach((r) => {
    $(`c-${r}`).addEventListener("input", (e) => setColor(r, e.target.value));
    $(`h-${r}`).addEventListener("change", (e) => {
      let v = e.target.value.trim();
      if (!v.startsWith("#")) v = "#" + v;
      if (validHex(v)) setColor(r, v);
      else e.target.value = $(`c-${r}`).value.toUpperCase();
    });
    document.querySelector(`.role[data-role="${r}"]`).addEventListener("click", (e) => {
      if (picked && !e.target.matches("input")) { setColor(r, picked); clearPick(); }
    });
  });
  function clearPick() {
    picked = null;
    document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("is-on"));
    document.querySelectorAll(".role").forEach((s) => s.classList.remove("can-drop"));
  }
  $("copyCodes").addEventListener("click", (e) => copy($("adminCodes").textContent, e.target));

  // ---------- logo upload ----------
  async function handleFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return status("Please upload a PNG, JPG, WebP or SVG image.", true);
    if (file.size > 8 * 1024 * 1024) return status("That file is over 8 MB. Please use a smaller logo.", true);
    try {
      const img = await Colors.loadImage(file);
      const { pngDataUrl, data } = Colors.rasterize(img);
      logo = { pngDataUrl };
      $("logoPreview").src = pngDataUrl;
      $("logoPreview").hidden = false;
      $("dropText").hidden = true;
      const found = Colors.extract(data);
      if (!found) { status("Couldn't find colours in this logo — pick them manually below.", true); return; }
      ["dark", "main", "accent"].forEach((r) => setColor(r, found[r]));
      $("swatches").innerHTML = found.swatches
        .map((h) => `<button type="button" class="swatch" data-hex="${h}" title="${h} · ${Colors.nameOf(h)}"><span></span>${h}</button>`)
        .join("");
      // colours set through the DOM (inline style attributes are blocked by the security policy)
      $("swatches").querySelectorAll(".swatch").forEach((el) => el.style.setProperty("--s", el.dataset.hex));
      $("swatchRow").hidden = false;
      status("Colours picked from the logo. Adjust them if needed.");
    } catch {
      status("Couldn't read that image. Try a PNG or JPG.", true);
    }
  }
  $("file").addEventListener("change", (e) => handleFile(e.target.files[0]));
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
  $("swatches").addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b) return;
    const was = b.classList.contains("is-on");
    clearPick();
    if (!was) {
      picked = b.dataset.hex;
      b.classList.add("is-on");
      document.querySelectorAll(".role").forEach((s) => s.classList.add("can-drop"));
    }
  });

  // ---------- prompts ----------
  function names() {
    return Object.fromEntries(roles.map((r) => [r, Colors.nameOf(color(r))]));
  }
  function fillLocal(s, n) {
    return s.replaceAll("[DARK]", n.dark).replaceAll("[MAIN]", n.main).replaceAll("[ACCENT]", n.accent);
  }
  function quick() {
    const t = tpl(), n = names();
    const rules = fillLocal(T.rules, n);
    show({
      template: t,
      names: n,
      mood: `Quick prompts — colours: ${n.dark}, ${n.main}, ${n.accent}`,
      tips: "",
      items: t.photos.map((p) => ({ file: p.file, size: p.size, prompt: `${fillLocal(p.prompt, n)} ${rules}` })),
    });
    status("Quick prompts ready.");
  }
  async function smart() {
    if (!Vault.isUnlocked()) { openKeyDialog(); return; }
    touch();
    const t = tpl();
    const colors = Object.fromEntries(roles.map((r) => [r, `${Colors.nameOf(color(r))} (${color(r)})`]));
    setBusy(true);
    status("Claude is reading the logo and writing prompts… (about 20–60 seconds)");
    try {
      const { result } = await Claude.run(Vault.get(), {
        model: settings.model,
        template: t,
        rules: T.rules,
        colors,
        pngDataUrl: logo?.pngDataUrl || "",
      });
      const byFile = new Map((result.prompts || []).map((p) => [String(p.file).trim(), String(p.prompt || "").trim()]));
      const n = { dark: result.colors?.dark || Colors.nameOf(color("dark")), main: result.colors?.main || Colors.nameOf(color("main")), accent: result.colors?.accent || Colors.nameOf(color("accent")) };
      let fallbacks = 0;
      const items = t.photos.map((p) => {
        let prompt = byFile.get(p.file);
        if (!prompt) { fallbacks++; prompt = `${fillLocal(p.prompt, n)} ${fillLocal(T.rules, n)}`; }
        return { file: p.file, size: p.size, prompt };
      });
      show({ template: t, names: n, mood: result.brand_mood ? `Brand mood: ${result.brand_mood}` : "", tips: result.tips || "", items });
      status(fallbacks ? `Done — ${fallbacks} prompt(s) were missing from Claude's reply and were filled in automatically.` : "Smart prompts ready.");
    } catch (err) {
      status(err.name === "AbortError" ? "Cancelled." : `Claude error: ${err.message}`, true);
    } finally {
      setBusy(false);
    }
  }
  function slug(s) {
    return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30);
  }
  function zipName() {
    const c = slug($("client").value);
    return `${c ? c + "-" : "client-"}${last.template.id}-photos.zip`;
  }
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
  function show(r) {
    last = r;
    $("result").hidden = false;
    $("mood").textContent = r.mood + (r.tips ? ` — Tip: ${r.tips}` : "");
    $("sendInfo").innerHTML =
      `<b>How to send back:</b> put all images directly inside <b>${esc(zipName())}</b> (no folders), named exactly as below. JPG or PNG both fine. ` +
      `Template folder: <b>${esc(r.template.folders)}</b>.`;
    $("list").innerHTML = r.items
      .map((it, i) => `<li class="item"><div class="item-top"><div><span class="fname">${esc(it.file)}</span><span class="size">${esc(it.size)}</span></div><button class="btn-small" type="button" data-i="${i}">Copy</button></div><p>${esc(it.prompt)}</p></li>`)
      .join("");
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function allText() {
    const n = last.names;
    return (
      `PHOTO PROMPTS — ${last.template.label}\nClient: ${$("client").value || "-"}\n` +
      `Website colours: dark ${color("dark")} (${n.dark}), main ${color("main")} (${n.main}), accent ${color("accent")} (${n.accent})\n` +
      `${last.mood}\nSend back as ${zipName()} with these exact file names.\n\n` +
      last.items.map((it) => `${it.file}  (${it.size})\n${it.prompt}`).join("\n\n") + "\n"
    );
  }
  $("list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b) copy(last.items[+b.dataset.i].prompt, b);
  });
  $("copyAll").addEventListener("click", (e) => copy(allText(), e.target));
  $("download").addEventListener("click", () => {
    const blob = new Blob([allText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = zipName().replace(/\.zip$/, "-prompts.txt");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("quickBtn").addEventListener("click", quick);
  $("smartBtn").addEventListener("click", smart);

  function setBusy(b) {
    $("smartBtn").disabled = b;
    $("quickBtn").disabled = b;
    $("smartBtn").textContent = b ? "Writing…" : "✨ Write smart prompts with Claude";
  }
  function status(msg, bad) {
    $("status").textContent = msg;
    $("status").classList.toggle("bad", !!bad);
  }
  function copy(text, btn) {
    navigator.clipboard.writeText(text).then(
      () => {
        const o = btn.textContent;
        btn.textContent = "Copied ✓";
        btn.classList.add("done");
        setTimeout(() => { btn.textContent = o; btn.classList.remove("done"); }, 1400);
      },
      () => status("Copy blocked by the browser — select the text and copy it manually.", true)
    );
  }

  // ---------- key handling ----------
  const dlg = $("keyDlg");
  function refreshKeyUI() {
    const unlocked = Vault.isUnlocked(), saved = Vault.hasSaved();
    $("keyText").textContent = unlocked ? "Claude ready" : saved ? "Key locked" : "No API key";
    $("keyPill").classList.toggle("ok", unlocked);
    $("unlockBox").hidden = unlocked || !saved;
    $("setBox").hidden = unlocked || saved;
    $("readyBox").hidden = !unlocked;
    $("dlgError").textContent = "";
  }
  function openKeyDialog(forceSet) {
    refreshKeyUI();
    if (forceSet) { $("unlockBox").hidden = true; $("readyBox").hidden = true; $("setBox").hidden = false; }
    const m = settings.model;
    $("modelPick").value = PRESETS.includes(m) ? m : "custom";
    $("model").value = m;
    $("modelCustomBox").hidden = PRESETS.includes(m);
    dlg.showModal();
    const first = dlg.querySelector("section:not([hidden]) input, div:not([hidden]) > label > input[type=password]");
    if (first) first.focus();
  }
  $("keyPill").addEventListener("click", () => openKeyDialog());
  $("settingsBtn").addEventListener("click", () => openKeyDialog());
  $("modelPick").addEventListener("change", (e) => {
    const custom = e.target.value === "custom";
    $("modelCustomBox").hidden = !custom;
    if (custom) $("model").focus();
    else settings.model = e.target.value;
  });
  $("model").addEventListener("change", (e) => {
    settings.model = e.target.value;
    e.target.value = settings.model; // show the corrected ID
  });
  $("remember").addEventListener("change", (e) => ($("passBox").hidden = !e.target.checked));
  $("saveKeyBtn").addEventListener("click", async () => {
    const key = $("apiKey").value.trim(), remember = $("remember").checked, p1 = $("pass1").value, p2 = $("pass2").value;
    if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(key)) return ($("dlgError").textContent = "That doesn't look like an Anthropic API key (it starts with sk-ant-).");
    if (remember && p1.length < 10) return ($("dlgError").textContent = "Passphrase must be at least 10 characters.");
    if (remember && p1 !== p2) return ($("dlgError").textContent = "The two passphrases don't match.");
    await Vault.save(key, p1, remember);
    $("apiKey").value = $("pass1").value = $("pass2").value = "";
    touch();
    refreshKeyUI();
  });
  $("unlockBtn").addEventListener("click", async () => {
    $("unlockBtn").disabled = true;
    $("dlgError").textContent = "";
    try {
      await Vault.unlock($("unlockPass").value);
      $("unlockPass").value = "";
      touch();
      refreshKeyUI();
    } catch (e) {
      $("dlgError").textContent = e.message;
    } finally {
      $("unlockBtn").disabled = false;
    }
  });
  $("unlockPass").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("unlockBtn").click(); } });
  $("forgetBtn").addEventListener("click", () => { Vault.forget(); refreshKeyUI(); });
  $("lockBtn").addEventListener("click", () => { Vault.lock(); refreshKeyUI(); });
  $("replaceBtn").addEventListener("click", () => { Vault.forget(); refreshKeyUI(); });

  // auto-lock after inactivity
  let idleTimer = null;
  function touch() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { Vault.lock(); refreshKeyUI(); status("API key locked after 30 minutes without use."); }, IDLE_LOCK_MS);
  }
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => Vault.isUnlocked() && touch(), { passive: true }));

  $("logoutBtn").addEventListener("click", () => window.Login && Login.logout());

  refreshColors();
  refreshKeyUI();
})();
