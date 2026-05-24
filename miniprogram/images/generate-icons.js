const fs = require("fs");
const path = require("path");

// 简单的1x1像素PNG (白色)
const whitePNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwYABgkCnMH+j5gAAAABJRU5ErkJggg==",
  "base64",
);

// 简单的1x1像素PNG (蓝色)
const bluePNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgGAWjYBSMglEwCkbBKBgFowAEcADmk6S6QAAAABJRU5ErkJggg==",
  "base64",
);

const icons = ["home", "run", "history"];

icons.forEach((name) => {
  fs.writeFileSync(path.join(__dirname, `${name}.png`), whitePNG);
  fs.writeFileSync(path.join(__dirname, `${name}-active.png`), bluePNG);
  console.log(`Created ${name}.png and ${name}-active.png`);
});

console.log("All icons generated!");
