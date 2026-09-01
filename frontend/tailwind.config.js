/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Semantic aliases onto the CSS variables in index.css, so no component
      // ever hard-codes a colour and the theme switch stays a one-line change.
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        inset: "var(--surface-inset)",
        line: "var(--line)",
        ink: "var(--text)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        strong: "var(--accent-strong)",
        highlight: "var(--highlight)",
        success: "var(--success)",
        danger: "var(--danger)",
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
        pixel: ['"Press Start 2P"', "monospace"],
        terminal: ['"VT323"', "monospace"],
      },
    },
  },
  plugins: [],
};
