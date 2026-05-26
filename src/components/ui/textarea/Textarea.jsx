import { useMemo, useRef } from "react";
import styles from "./Textarea.module.css";

const PARAM_TOKEN_REGEX = /\{\{\s*[\w.-]+\s*\}\}|\{\s*[\w.-]+\s*\}/g;

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getHighlightedMarkup(value) {
  if (!value) return "";

  let result = "";
  let lastIndex = 0;
  let match = PARAM_TOKEN_REGEX.exec(value);

  while (match) {
    const [token] = match;
    result += escapeHtml(value.slice(lastIndex, match.index));
    result += `<span class="${styles.paramToken}">${escapeHtml(token)}</span>`;
    lastIndex = match.index + token.length;
    match = PARAM_TOKEN_REGEX.exec(value);
  }

  result += escapeHtml(value.slice(lastIndex));
  PARAM_TOKEN_REGEX.lastIndex = 0;
  return result;
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 6,
  label,
  mono,
  className = "",
  highlightParameterizedTokens = false,
  ...props
}) {
  const highlightLayerRef = useRef(null);
  const highlightedMarkup = useMemo(
    () => getHighlightedMarkup(value || ""),
    [value]
  );

  function syncScroll(event) {
    const layer = highlightLayerRef.current;
    if (!layer) return;
    layer.scrollTop = event.target.scrollTop;
    layer.scrollLeft = event.target.scrollLeft;
  }

  const textareaClassName = `${styles.textarea} ${mono ? styles.mono : ""} ${
    highlightParameterizedTokens ? styles.overlayTextarea : ""
  }`;

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      {highlightParameterizedTokens ? (
        <div className={styles.highlightContainer}>
          <pre
            ref={highlightLayerRef}
            className={`${styles.highlightLayer} ${mono ? styles.mono : ""}`}
            aria-hidden="true"
            dangerouslySetInnerHTML={{
              __html: highlightedMarkup || escapeHtml(placeholder || ""),
            }}
          />
          <textarea
            className={textareaClassName}
            value={value}
            onChange={onChange}
            onScroll={syncScroll}
            placeholder={placeholder}
            rows={rows}
            {...props}
          />
        </div>
      ) : (
        <textarea
          className={textareaClassName}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          {...props}
        />
      )}
    </div>
  );
}

export default Textarea;
