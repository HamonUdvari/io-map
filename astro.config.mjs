import {defineConfig} from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://hamonudvari.github.io",
  base: "/io-map",
  devToolbar: {enabled: false},
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // notebook-kit's CDN-style imports (npm:d3) resolve from node_modules here,
      // so the docs/lib map modules are shared with the notebooks unchanged.
      alias: [{find: /^npm:(.*)$/, replacement: "$1"}]
    }
  }
});
