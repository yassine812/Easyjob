import { expect, it } from 'vitest';
import { laplacianVariance } from './face-image-quality';

function pixels(value: (x: number, y: number) => number) {
  const width = 24, height = 24;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value(x, y); data[i + 3] = 255;
  }
  return { data, width, height };
}

it('rejects smooth or blank image regions while accepting resolved detail', () => {
  expect(laplacianVariance(pixels(() => 128))).toBe(0);
  expect(laplacianVariance(pixels((x, y) => x * 3 + y * 2))).toBeLessThan(80);
  expect(laplacianVariance(pixels((x, y) => (x + y) % 2 ? 180 : 80))).toBeGreaterThan(80);
});
