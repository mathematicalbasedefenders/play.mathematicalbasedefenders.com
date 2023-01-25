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
        exclude: [/node_modules/, /uWebSocket/]
      },
      {
        test: /\.ts?$/,
        use: "ts-loader",
        exclude: [/node_modules/, /uWebSocket/],
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
