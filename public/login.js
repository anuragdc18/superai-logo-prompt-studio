/* Login gate. Checks ID + password against the salted PBKDF2 hash in auth-config.js.
   The session lasts until the browser tab is closed (sessionStorage). */
(function () {
  const KEY = "lps_session";
  const enc = new TextEncoder();
  const $ = (id) => document.getElementById(id);
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));

  async function hashOf(user, pass, saltHex, iterations) {
    const base = await crypto.subtle.importKey("raw", enc.encode(`${user.trim().toLowerCase()}:${pass}`), "PBKDF2", false, ["deriveBits"]);
    return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations }, base, 256));
  }
  function same(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }
  const isIn = () => { try { return sessionStorage.getItem(KEY) === window.LOGIN.hash; } catch { return false; } };
  function open() { document.body.classList.remove("locked"); $("loginScreen").hidden = true; $("app").hidden = false; }

  let fails = 0, waitUntil = 0;
  async function submit(e) {
    e.preventDefault();
    const now = Date.now();
    if (now < waitUntil) { $("loginErr").textContent = `Too many tries. Wait ${Math.ceil((waitUntil - now) / 1000)} seconds.`; return; }
    $("loginBtn").disabled = true;
    $("loginErr").textContent = "";
    const L = window.LOGIN;
    const h = await hashOf($("loginId").value, $("loginPass").value, L.salt, L.iterations);
    $("loginBtn").disabled = false;
    if (same(h, L.hash)) {
      try { sessionStorage.setItem(KEY, L.hash); } catch {}
      $("loginPass").value = "";
      open();
    } else {
      fails++;
      if (fails >= 5) { waitUntil = Date.now() + 30000 * (fails - 4); }
      $("loginErr").textContent = "Wrong login ID or password.";
      $("loginPass").select();
    }
  }
  window.Login = {
    logout() { try { sessionStorage.removeItem(KEY); } catch {} if (window.Vault) Vault.lock(); location.reload(); },
  };
  $("loginForm").addEventListener("submit", submit);
  if (isIn()) open();
  else { $("loginScreen").hidden = false; $("loginId").focus(); }
})();
