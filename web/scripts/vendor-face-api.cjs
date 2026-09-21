/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS build script. */
const fs = require('node:fs');
const path = require('node:path');
const source = path.dirname(require.resolve('@vladmandic/face-api/package.json'));
const target = path.resolve(__dirname, '../public/vendor/face-api');
fs.mkdirSync(path.join(target, 'models'), { recursive: true });
fs.copyFileSync(path.join(source, 'dist/face-api.js'), path.join(target, 'face-api.js'));
fs.copyFileSync(path.join(source, 'LICENSE'), path.join(target, 'LICENSE'));
for (const model of ['tiny_face_detector_model', 'face_landmark_68_tiny_model']) {
  for (const suffix of ['.bin', '-weights_manifest.json']) fs.copyFileSync(path.join(source, 'model', model + suffix), path.join(target, 'models', model + suffix));
}
console.log('Face API 1.7.15: local detector and landmark assets ready');
