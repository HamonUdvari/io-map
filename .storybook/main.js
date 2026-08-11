const config = {
  stories: ["../src/lib/ui/**/*.stories.js"],
  framework: {name: "@storybook/html-vite", options: {}},
  async viteFinal(config) {
    // Tailwind v4's vite plugin must be loaded lazily inside viteFinal
    // (https://github.com/tailwindlabs/tailwindcss/discussions/16451).
    const {default: tailwindcss} = await import("@tailwindcss/vite");
    const {mergeConfig} = await import("vite");
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      // same alias as astro.config.mjs, so stories can mount docs/lib map modules
      resolve: {alias: [{find: /^npm:(.*)$/, replacement: "$1"}]}
    });
  }
};

export default config;
