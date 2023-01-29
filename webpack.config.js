const path = require("path");

module.exports = {
  entry: "./src/public/js/index.ts",
  target: "web",
  mode: "production",
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: [/node_modules/, /uWebSocket/, /adaptive-scale/]
      },
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: [/node_modules/, /uWebSocket/, /adaptive-scale/],
        include: ["/src/public/js/*"]
      }
    ]
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  },
  output: {
    filename: "public/js/bundle.js",
    path: path.resolve(__dirname, "dist")
  }
};
