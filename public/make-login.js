(function () {
  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const $ = (id) => document.getElementById(id);
  $("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = $("u").value.trim().toLowerCase(), pass = $("p").value;
    $("err").textContent = "";
    if (user.length < 3) return ($("err").textContent = "Login ID must be at least 3 characters.");
    if (pass.length < 10) return ($("err").textContent = "Password must be at least 10 characters.");
    const salt = crypto.getRandomValues(new Uint8Array(16)), iterations = 310000;
    const base = await crypto.subtle.importKey("raw", enc.encode(`${user}:${pass}`), "PBKDF2", false, ["deriveBits"]);
    const hash = hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, 256));
    $("out").value = `window.LOGIN = ${JSON.stringify({ salt: hex(salt), iterations, hash })};`;
    $("out").hidden = false;
    $("out").select();
  });
})();
