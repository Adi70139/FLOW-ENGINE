/**
 * parseCurl — Robust cURL command parser.
 * Handles multi-line (backslash continuation), various data flags,
 * quoted strings with escaped quotes, and common flags.
 */
export function parseCurl(raw) {
  try {
    // Normalize: join backslash-continued lines, collapse whitespace
    const normalized = raw
      .replace(/\\\r?\n/g, " ")
      .replace(/\r?\n/g, " ")
      .trim();

    const tokens = tokenize(normalized);

    let method = "";
    let url = "";
    const headers = [];
    let data = "";
    let hasData = false;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t === "curl") continue;

      // Method
      if (t === "-X" || t === "--request") {
        method = (tokens[++i] || "GET").toUpperCase();
        continue;
      }

      // Headers
      if (t === "-H" || t === "--header") {
        const hdr = tokens[++i] || "";
        const colonIdx = hdr.indexOf(":");
        if (colonIdx !== -1) {
          headers.push({
            key: hdr.slice(0, colonIdx).trim(),
            value: hdr.slice(colonIdx + 1).trim(),
            enabled: true,
          });
        }
        continue;
      }

      // Data flags
      if (
        t === "-d" ||
        t === "--data" ||
        t === "--data-raw" ||
        t === "--data-binary" ||
        t === "--data-urlencode"
      ) {
        data = tokens[++i] || "";
        hasData = true;
        continue;
      }

      // Skip known flags with values
      if (
        t === "-u" || t === "--user" ||
        t === "-o" || t === "--output" ||
        t === "-A" || t === "--user-agent" ||
        t === "--connect-timeout" ||
        t === "--max-time"
      ) {
        i++;
        continue;
      }

      // Skip known boolean flags
      if (
        t === "--compressed" ||
        t === "--location" ||
        t === "-L" ||
        t === "-k" ||
        t === "--insecure" ||
        t === "-s" ||
        t === "--silent" ||
        t === "-v" ||
        t === "--verbose" ||
        t === "-i"
      ) {
        continue;
      }

      // URL detection
      if (!url && (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("www."))) {
        url = t;
        continue;
      }

      // Fallback: if it looks like a URL
      if (!url && !t.startsWith("-") && t.includes(".") && t.includes("/")) {
        url = t;
      }
    }

    // Infer method from data presence
    if (!method) {
      method = hasData ? "POST" : "GET";
    }

    // Auto-detect content-type from headers
    const contentType = headers.find(
      (h) => h.key.toLowerCase() === "content-type"
    );

    return { method, url, headers, data, contentType: contentType?.value || "" };
  } catch (e) {
    return { method: "GET", url: "", headers: [], data: "", contentType: "" };
  }
}

/**
 * Tokenize a curl command string, respecting single and double quotes.
 */
function tokenize(str) {
  const tokens = [];
  let i = 0;

  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    const ch = str[i];

    if (ch === "'" || ch === '"') {
      // Quoted token
      const quote = ch;
      i++;
      let token = "";
      while (i < str.length && str[i] !== quote) {
        if (str[i] === "\\" && i + 1 < str.length) {
          // Escaped character
          i++;
          token += str[i];
        } else {
          token += str[i];
        }
        i++;
      }
      i++; // skip closing quote
      tokens.push(token);
    } else {
      // Unquoted token
      let token = "";
      while (i < str.length && !/\s/.test(str[i])) {
        token += str[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}
