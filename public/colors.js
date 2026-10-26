/* Logo colour extraction + friendly colour names. Runs fully in the browser. */
(function () {
  // ---- colour maths ----
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
  const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  function toLab([r, g, b]) {
    const f = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    let [R, G, B] = [f(r), f(g), f(b)];
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const g3 = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    [x, y, z] = [g3(x), g3(y), g3(z)];
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const chroma = (lab) => Math.hypot(lab[1], lab[2]);
  function hsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function fromHsl(h, s, l) {
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  const luminance = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (h1, h2) => {
    const [a, b] = [luminance(rgbOf(h1)), luminance(rgbOf(h2))].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };

  // ---- friendly names (image tools understand names better than codes) ----
  const NAMES = [
    ["black", "#111111"], ["charcoal", "#36454F"], ["dark grey", "#4A4A4A"], ["slate grey", "#708090"], ["silver grey", "#B8BCC2"], ["white", "#FFFFFF"], ["ivory", "#FFFDF0"], ["cream", "#F5ECD7"], ["beige", "#E2D3B5"], ["sand", "#D8C39A"], ["taupe", "#8B7D6B"],
    ["navy blue", "#1B2A57"], ["midnight blue", "#14213D"], ["royal blue", "#2450D3"], ["cobalt blue", "#1F45C4"], ["electric blue", "#2F6BFF"], ["sky blue", "#5BB8F0"], ["baby blue", "#A9D3F5"], ["steel blue", "#4682B4"], ["denim blue", "#3B5C8C"], ["indigo", "#3F2E8C"], ["ice blue", "#D6EEFA"],
    ["teal", "#0E8C8C"], ["deep teal", "#0B5C5C"], ["turquoise", "#22C3C3"], ["aqua", "#4FE0D8"], ["cyan", "#18C6E6"],
    ["emerald green", "#0F9D58"], ["forest green", "#1F4A35"], ["dark green", "#0F3D2A"], ["bottle green", "#0B4D3A"], ["olive green", "#6B7B2C"], ["sage green", "#9CB59A"], ["mint green", "#9FE3C2"], ["lime green", "#9BD12F"], ["neon lime", "#C6F135"], ["leaf green", "#3DA35D"], ["whatsapp green", "#25D366"],
    ["mustard yellow", "#D9A21B"], ["golden yellow", "#F4B71B"], ["sunflower yellow", "#FFD21F"], ["lemon yellow", "#FFF06A"], ["gold", "#D4AF61"], ["antique gold", "#B8913E"], ["amber", "#FFB300"],
    ["saffron", "#FF8F1F"], ["orange", "#FF6A13"], ["burnt orange", "#C9550F"], ["tangerine", "#FF7A1A"], ["peach", "#FFC9A8"], ["apricot", "#F8B07A"], ["terracotta", "#C25B32"], ["rust", "#A8451F"], ["copper", "#B87333"],
    ["red", "#E0452F"], ["crimson", "#C8102E"], ["scarlet", "#FF2E2E"], ["cherry red", "#B0102C"], ["maroon", "#7A1E2C"], ["burgundy", "#6D1A36"], ["wine red", "#5E1224"], ["brick red", "#A23B2A"], ["coral", "#FF6F61"], ["salmon pink", "#F7A08C"],
    ["hot pink", "#F0408C"], ["magenta", "#D1268C"], ["rose pink", "#E8879E"], ["blush pink", "#F6C9D2"], ["fuchsia", "#C0279B"],
    ["purple", "#7A3DD8"], ["violet", "#6D4AFF"], ["lavender", "#C9B6FB"], ["lilac", "#D8B8E8"], ["plum", "#6B2C5C"], ["deep purple", "#3A1D6E"], ["mauve", "#B07CA0"],
    ["chocolate brown", "#4E2C1E"], ["coffee brown", "#6F4E37"], ["tan", "#C49A6C"], ["caramel", "#C27C3A"], ["walnut brown", "#5C3B24"],
  ].map(([n, h]) => [n, toLab(rgbOf(h))]);
  function nameOf(h) {
    const lab = toLab(rgbOf(h));
    let best = NAMES[0], bd = Infinity;
    for (const n of NAMES) { const d = dist(lab, n[1]); if (d < bd) { bd = d; best = n; } }
    return best[0];
  }

  // ---- extraction ----
  async function loadImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }

  /** Draw the logo on a canvas: returns a PNG data URL (for Claude) and pixel data (for colours). */
  function rasterize(img, max = 512) {
    const w0 = img.naturalWidth || 512, h0 = img.naturalHeight || 512;
    const s = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w0 * s)); c.height = Math.max(1, Math.round(h0 * s));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    // flatten transparency on white for the copy sent to Claude
    const out = document.createElement("canvas");
    out.width = c.width; out.height = c.height;
    const o = out.getContext("2d");
    o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height); o.drawImage(c, 0, 0);
    return { pngDataUrl: out.toDataURL("image/png"), data };
  }

  function kmeans(points, k, iters = 12) {
    let cents = [];
    for (let i = 0; i < k; i++) cents.push(points[Math.floor(((i + 0.5) / k) * points.length)].slice());
    let assign = new Array(points.length).fill(0);
    for (let it = 0; it < iters; it++) {
      for (let p = 0; p < points.length; p++) {
        let bi = 0, bd = Infinity;
        for (let c = 0; c < k; c++) { const d = dist(points[p], cents[c]); if (d < bd) { bd = d; bi = c; } }
        assign[p] = bi;
      }
      const sums = cents.map(() => [0, 0, 0, 0, 0, 0, 0]);
      for (let p = 0; p < points.length; p++) { const s = sums[assign[p]], q = points[p]; for (let j = 0; j < 6; j++) s[j] += q[j]; s[6]++; }
      cents = cents.map((c, i) => (sums[i][6] ? sums[i].slice(0, 6).map((v) => v / sums[i][6]) : c));
    }
    const counts = cents.map(() => 0);
    assign.forEach((a) => counts[a]++);
    return cents.map((c, i) => ({ lab: c.slice(0, 3), rgb: c.slice(3, 6), count: counts[i] })).filter((c) => c.count > 0);
  }

  /** Returns { dark, main, accent, swatches } as hex codes. */
  function extract(data) {
    const pts = [];
    const step = Math.max(1, Math.floor(data.length / 4 / 20000));
    for (let i = 0; i < data.length; i += 4 * step) {
      const a = data[i + 3];
      if (a < 160) continue;
      const rgb = [data[i], data[i + 1], data[i + 2]];
      const lab = toLab(rgb);
      if (lab[0] > 95 && chroma(lab) < 6) continue; // white background
      pts.push([...lab, ...rgb]);
    }
    if (pts.length < 20) return null;
    pts.sort((a, b) => a[0] - b[0]);
    const clusters = kmeans(pts, Math.min(6, pts.length)).sort((a, b) => b.count - a.count);
    const total = clusters.reduce((n, c) => n + c.count, 0);
    const sig = clusters.filter((c) => c.count / total > 0.02);
    const swatches = sig.map((c) => hex(...c.rgb));
    const colourful = sig.filter((c) => chroma(c.lab) > 18).sort((a, b) => b.count * (1 + chroma(b.lab) / 60) - a.count * (1 + chroma(a.lab) / 60));
    // prefer a neutral black/grey/navy for the dark colour when the logo has one
    const darks = sig.filter((c) => c.lab[0] < 32).sort((a, b) => b.count * (chroma(b.lab) < 20 ? 3 : 1) - a.count * (chroma(a.lab) < 20 ? 3 : 1));

    let main = colourful[0] || sig[0];
    let mainHex = hex(...main.rgb);
    let [h, s, l] = hsl(main.rgb);

    // dark/base: a real dark colour from the logo, else a deep shade of the main colour
    const darkPick = darks.find((c) => c !== main && dist(c.lab, main.lab) > 12);
    let darkHex = darkPick ? hex(...darkPick.rgb) : hex(...fromHsl(h, Math.min(0.7, s * 0.9 + 0.1), 0.16));

    // accent: the most different colourful cluster, else a warm/cool complement of main
    let accent = colourful.slice(1).sort((a, b) => dist(b.lab, main.lab) - dist(a.lab, main.lab))[0];
    let accentHex = accent && dist(accent.lab, main.lab) > 25 ? hex(...accent.rgb) : hex(...fromHsl((h + 150) % 360, Math.max(0.65, s), 0.55));

    // a near-white or very pale main colour is useless on a website: darken it
    if (l > 0.82) mainHex = hex(...fromHsl(h, Math.max(0.5, s), 0.45));
    return { dark: darkHex, main: mainHex, accent: accentHex, swatches };
  }

  window.Colors = { loadImage, rasterize, extract, nameOf, contrast, rgbOf };
})();
