import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        firefly: {
          50: "rgb(247 254 231)",
          200: "rgb(217 249 157)",
          400: "rgb(163 230 53)",
          500: "rgb(132 204 22)",
          700: "rgb(77 124 15)"
        }
      },
      boxShadow: {
        glass: "0 4px 20px rgba(0,0,0,.25)",
        "lime-glow": "0 0 34px rgba(132,204,22,.32)"
      },
      backdropBlur: {
        glass: "20px"
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};

export default config;
