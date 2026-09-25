'use client';
import * as THREE from 'three';

/**
 * A rectangular-ish paper panel whose rows can have varying width (for the
 * envelope flap's rounded triangle) and which can be bent with constant
 * curvature around a hinge. Geometry lives in a local 2D frame:
 *   x  = across the hinge,  s = distance from the hinge along the panel.
 * `apply(a, k, lift)` writes 3D positions where the panel starts at the hinge
 * with angle `a` (0 = flat along +U, π/2 = straight up along +V) and bends
 * with curvature `k` (1/m).  U/V are the hinge-frame axes provided by caller.
 */
export class BendPanel {
  readonly geometry: THREE.BufferGeometry;
  private rest: Float32Array; // pairs (x, s)
  private pos: THREE.BufferAttribute;
  constructor(
    public readonly width: number,
    public readonly length: number,
    cols: number,
    rows: number,
    halfWidthAt: (t: number) => number = () => width / 2,
    uvFor: (x: number, s: number) => [number, number] = (x, s) => [x / width + 0.5, s / length],
  ) {
    const verts = (cols + 1) * (rows + 1);
    this.rest = new Float32Array(verts * 2);
    const positions = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const idx: number[] = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const s = t * length;
      const hw = halfWidthAt(t);
      for (let c = 0; c <= cols; c++) {
        const x = -hw + (2 * hw * c) / cols;
        const i = r * (cols + 1) + c;
        this.rest[i * 2] = x;
        this.rest[i * 2 + 1] = s;
        const [u, v] = uvFor(x, s);
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
      }
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + 1;
        const d = a + cols + 1;
        const e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(positions, 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(idx);
    this.geometry = g;
    this.apply(0, 0, 0);
  }

  /** Position (u along panel-flat axis, v along normal axis) at distance s. */
  static curve(a: number, k: number, s: number): [number, number, number] {
    if (Math.abs(k) < 1e-4) return [Math.cos(a) * s, Math.sin(a) * s, a];
    const e = a + k * s;
    return [(Math.sin(e) - Math.sin(a)) / k, (Math.cos(a) - Math.cos(e)) / k, e];
  }

  /**
   * Writes positions in a frame where X = across hinge, Y = normal of the
   * resting panel (up), Z = the flat direction of the resting panel.
   * `offset` pushes the panel along its local normal (avoids z-fighting).
   */
  apply(a: number, k: number, offset: number) {
    const p = this.pos.array as Float32Array;
    const n = this.rest.length / 2;
    for (let i = 0; i < n; i++) {
      const x = this.rest[i * 2];
      const s = this.rest[i * 2 + 1];
      const [u, v, e] = BendPanel.curve(a, k, s);
      // local normal of the bent strip at s
      const nu = -Math.sin(e);
      const nv = Math.cos(e);
      p[i * 3] = x;
      p[i * 3 + 1] = v + nv * offset;
      p[i * 3 + 2] = u + nu * offset;
    }
    this.pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

/**
 * A sheet that is rolled up into a scroll and can be unrolled.
 * Local frame: X across the sheet, Y up (top edge at +h/2), front faces +Z.
 * The rolled part wraps toward +Z (text inside, like a real rolled letter).
 */
export class ScrollPanel {
  readonly geometry: THREE.BufferGeometry;
  private rest: Float32Array;
  private pos: THREE.BufferAttribute;
  constructor(
    public readonly width: number,
    public readonly height: number,
    public readonly radius = 0.0085,
    cols = 6,
    rows = 150,
  ) {
    const verts = (cols + 1) * (rows + 1);
    this.rest = new Float32Array(verts * 2);
    const positions = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const idx: number[] = [];
    for (let r = 0; r <= rows; r++) {
      const s = (r / rows) * height;
      for (let c = 0; c <= cols; c++) {
        const x = -width / 2 + (width * c) / cols;
        const i = r * (cols + 1) + c;
        this.rest[i * 2] = x;
        this.rest[i * 2 + 1] = s;
        uvs[i * 2] = x / width + 0.5;
        uvs[i * 2 + 1] = 1 - s / height;
      }
    }
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + 1;
        const d = a + cols + 1;
        const e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(positions, 3);
    this.pos.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(idx);
    this.geometry = g;
    this.apply(0);
  }

  /** local position of the roll's axis for a given unroll amount */
  rollCentre(unroll: number): [number, number] {
    const flat = unroll * this.height;
    return [this.height / 2 - flat, this.radius];
  }

  /** unroll: 0 = fully rolled, 1 = flat. `curl` adds a soft lift to the free edge */
  apply(unroll: number, curl = 0) {
    const p = this.pos.array as Float32Array;
    const n = this.rest.length / 2;
    const H = this.height;
    const flat = Math.min(H, Math.max(0, unroll) * H);
    const y0 = H / 2 - flat;
    const R = this.radius;
    for (let i = 0; i < n; i++) {
      const x = this.rest[i * 2];
      const s = this.rest[i * 2 + 1];
      let y: number;
      let z: number;
      if (s <= flat) {
        y = H / 2 - s;
        // a freshly unrolled sheet keeps a little memory of the roll near its free end
        z = curl * 0.012 * Math.pow(s / Math.max(flat, 1e-4), 3);
      } else {
        const th = (s - flat) / R;
        const r = Math.max(R * 0.35, R - 0.00032 * th);
        y = y0 - r * Math.sin(th);
        z = R - r * Math.cos(th);
      }
      p[i * 3] = x;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = z;
    }
    this.pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}
