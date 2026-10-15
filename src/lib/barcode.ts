const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
};

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function barcodeSvg(value: string) {
  const text = `*${value.toUpperCase().replace(/[^0-9A-Z\-.\s]/g, "")}*`;
  let x = 8;
  const rects: string[] = [];
  for (const char of text) {
    const pattern = CODE39[char];
    if (!pattern) continue;
    for (let index = 0; index < pattern.length; index += 1) {
      const width = pattern[index] === "w" ? 2.4 : 1;
      if (index % 2 === 0) rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${width}" height="64"/>`);
      x += width;
    }
    x += 1;
  }
  const width = Math.ceil(x + 8);
  const label = xml(value);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 86" role="img" aria-label="Barcode ${label}"><g fill="currentColor">${rects.join("")}</g><text x="${width / 2}" y="82" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11">${label}</text></svg>`;
}
