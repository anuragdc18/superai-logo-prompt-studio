/* Keeps the Claude API key safe on a static site.
   The key is NEVER in the code or on GitHub. It is encrypted in this browser
   (AES-256-GCM, key derived from your passphrase with PBKDF2-SHA256, 600,000 rounds)
   and only decrypted into memory after you type the passphrase. */
(function () {
  const STORE = "lps_vault_v1";
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  let memoryKey = null;

  async function derive(pass, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 600000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(STORE) || "null"); } catch { return null; }
  }

  window.Vault = {
    hasSaved: () => !!read(),
    isUnlocked: () => !!memoryKey,
    get: () => memoryKey,
    async save(apiKey, pass, remember) {
      memoryKey = apiKey;
      if (!remember) return;
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const k = await derive(pass, salt);
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(apiKey));
      localStorage.setItem(STORE, JSON.stringify({ salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
    },
    async unlock(pass) {
      const v = read();
      if (!v) throw new Error("No saved key");
      const k = await derive(pass, unb64(v.salt));
      try {
        memoryKey = dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(v.iv) }, k, unb64(v.ct)));
      } catch {
        throw new Error("Wrong passphrase");
      }
    },
    lock() { memoryKey = null; },
    forget() { memoryKey = null; try { localStorage.removeItem(STORE); } catch {} },
  };
})();
