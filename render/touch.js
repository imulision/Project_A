// The finger on the map: drag to pan, pinch or wheel to zoom, a short touch that does not move is a tap.
// makeTouch(ctx) listens on the canvas; stop() is called when the finger takes the camera back from a journey.
export function makeTouch({ THREE, el, cam, VIEW, K, clamp, pickAt, onTap, stop }) {
  const pts = new Map(); let pinch = 0;
  const right = new THREE.Vector3(1, 0, -1).normalize(), fwd = new THREE.Vector3(-1, 0, -1).normalize();
  function pan(dx, dy) {
    const k = (2 * VIEW / cam.zoom) / innerHeight;
    cam.position.add(right.clone().multiplyScalar(-dx * k)).add(fwd.clone().multiplyScalar(dy * k / 0.66));
  }
  function zoomBy(f) { cam.zoom = clamp(cam.zoom * f, 0.6, 24 * K); cam.updateProjectionMatrix(); }
  el.style.touchAction = 'none';
  let tap = null;
  el.addEventListener('pointerdown', e => { stop(); tap = pts.size ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; pts.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); pinch = 0; });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) pan(dx, dy);
    else if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomBy(d / pinch); pinch = d; }
  });
  const up = e => { pts.delete(e.pointerId); pinch = 0;
    if (tap && e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 9 && performance.now() - tap.t < 500 && onTap) onTap(pickAt(e.clientX, e.clientY), e.clientX, e.clientY);
    tap = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
}
