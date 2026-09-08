const config = {
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  framework: {name: "@storybook/preact-vite", options: {}},
  async viteFinal(config) {
    // Tailwind v4's vite plugin must be loaded lazily inside viteFinal
    // (https://github.com/tailwindlabs/tailwindcss/discussions/16451).
    const {default: tailwindcss} = await import("@tailwindcss/vite");
    const {mergeConfig} = await import("vite");
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      // one preact instance across renderer, jsx-runtime, hooks and signals —
      // optimized separately they become two instances and hooks crash (__H)
      optimizeDeps: {
        include: ["preact", "preact/hooks", "preact/jsx-runtime", "preact/jsx-dev-runtime",
                  "@preact/signals", "@preact/signals-core"]
      },
      resolve: {
        dedupe: ["preact", "@preact/signals", "@preact/signals-core"],
        // same alias as astro.config.mjs, so stories can mount docs/lib map modules
        alias: [{find: /^npm:(.*)$/, replacement: "$1"}]
      }
    });
  }
};

export default config;
