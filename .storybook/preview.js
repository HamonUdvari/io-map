import "../src/styles/global.css";

export default {
  parameters: {
    backgrounds: {
      options: {
        surface: { name: "Surface", value: "#5b5b5b" },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: "surface" },
  },
};
