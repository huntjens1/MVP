/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        calllogix: {
          primary: "#2563eb",   // Blauw (sidebar, titels, primair)
          accent: "#06b6d4",    // Cyaan (knoppen, highlight)
          dark: "#10172a",      // Heel donker blauw (achtergrond)
          card: "#1e293b",      // Panel achtergrond
          text: "#f4f7fa",      // Bijna wit (tekst)
          subtext: "#64748b",   // Slate/grijs (subtekst, borders)
        },
      },
    },
  },
  plugins: [],
};
