/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Semantic aliases onto the CSS variables in index.css, so no component
      // ever hard-codes a colour and the theme switch stays a one-line change.
      // The `on-*` pairs carry the text colour that stays legible on each fill.
      colors: {
        bg: "var(--bg)",
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        inset: "var(--surface-inset)",
        line: "var(--line)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "on-accent": "var(--on-accent)",
        strong: "var(--accent-strong)",
        "on-strong": "var(--on-strong)",
        highlight: "var(--highlight)",
        "on-highlight": "var(--on-highlight)",
        success: "var(--success)",
        danger: "var(--danger)",
        "on-danger": "var(--on-danger)",
        node: "var(--node-bg)",
        "node-hover": "var(--node-bg-hover)",
        "node-ink": "var(--node-text)",
      },
      boxShadow: {
        pixel: "4px 4px 0 var(--shadow)",
        "pixel-sm": "3px 3px 0 var(--shadow)",
        "pixel-lg": "6px 6px 0 var(--shadow)",
        "pixel-accent": "4px 4px 0 var(--accent)",
        "pixel-highlight": "5px 5px 0 var(--highlight)",
        "pixel-strong": "5px 5px 0 var(--accent-strong)",
      },
      fontFamily: {
        // Pixel face for chrome and labels; terminal face for anything the
        // user actually has to read.
        pixel: ['"Press Start 2P"', "monospace"],
        terminal: ['"VT323"', "monospace"],
      },
    },
  },
  plugins: [],
};
