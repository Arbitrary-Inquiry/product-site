const fs   = require("fs");
const path = require("path");
const yaml = require("js-yaml");

module.exports = () => {
  const dir = path.join(__dirname, "icps");
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".yaml"))
    .map(f => yaml.load(fs.readFileSync(path.join(dir, f), "utf8")));
};
