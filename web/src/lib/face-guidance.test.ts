import { describe, expect, it } from 'vitest';
import { capturePosition, facePose, type FaceObservation } from './face-guidance';
function face(noseX: number): FaceObservation {
  const positions = Array.from({ length: 68 }, () => ({ x: 320, y: 200 }));
  positions[36].x = 280; positions[45].x = 360; positions[30].x = noseX;
  return { detection: { score: .95, box: { x: 200, y: 100, width: 240, height: 280 } }, landmarks: { positions } };
}
describe('camera pose guidance', () => {
  it('accepts small lateral movements only while the face remains frontal', () => {
    const frontal = face(320);
    expect(capturePosition([frontal], 640, 480)).toBe('center');
    const left = face(320); left.detection.box.x += 32;
    const right = face(320); right.detection.box.x -= 32;
    expect(capturePosition([left], 640, 480, .5)).toBe('left');
    expect(capturePosition([right], 640, 480, .5)).toBe('right');
    expect(capturePosition([face(345)], 640, 480, .5)).toBe('position');
    expect(capturePosition([], 640, 480, .5)).toBe('none');
    expect(capturePosition([frontal, left], 640, 480, .5)).toBe('multiple');
    left.detection.box.x += 64;
    expect(capturePosition([left], 640, 480, .5)).toBe('position');
  });
  it('requires exactly one sufficiently visible face', () => {
    expect(facePose([], 640, 480)).toBe('none');
    expect(facePose([face(320), face(320)], 640, 480)).toBe('multiple');
    const small = face(320); small.detection.box.width = 60;
    expect(facePose([small], 640, 480)).toBe('position');
  });
  it('distinguishes frontal, left, right, and incomplete turns', () => {
    expect(facePose([face(320)], 640, 480)).toBe('center');
    expect(facePose([face(345)], 640, 480)).toBe('left');
    expect(facePose([face(295)], 640, 480)).toBe('right');
    expect(facePose([face(327)], 640, 480)).toBe('position');
  });
});
