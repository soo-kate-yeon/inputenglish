import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@framingui/ui/dist/**/*.{js,mjs}",
  ],
  plugins: [require("tailwindcss-animate")],
};

export default config;
