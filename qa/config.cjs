const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const base = (process.env.BASE_URL || 'http://localhost:8094').replace(/\/+$/, '');
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname, 'artifacts'));
fs.mkdirSync(outputDir, {recursive: true});

module.exports = {
  chromium,
  base,
  artifact: name => path.join(outputDir, name),
  axePath: require.resolve('axe-core/axe.min.js'),
  webAsset: name => path.join(__dirname, '..', 'web', name),
};
