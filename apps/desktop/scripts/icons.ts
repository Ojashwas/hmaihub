import { deflateSync, crc32 } from "node:zlib";
import type { ProductId } from "../src/shared/products.ts";

const SIZE = 256;

type Rect = [x: number, y: number, w: number, h: number];

/** Simple geometric glyph per product, drawn in white on the product colour. */
const GLYPHS: Record<ProductId, Rect[]> = {
  suite: [
    [60, 60, 60, 60],
    [136, 60, 60, 60],
    [60, 136, 60, 60],
    [136, 136, 60, 60]
  ],
  hyperdoc: [
    [64, 64, 128, 14],
    [64, 98, 128, 14],
    [64, 132, 128, 14],
    [64, 166, 84, 14]
  ],
  hypersheet: [
    [60, 60, 136, 8],
    [60, 102, 136, 8],
    [60, 144, 136, 8],
    [60, 188, 136, 8],
    [60, 60, 8, 136],
    [124, 60, 8, 136],
    [188, 60, 8, 136]
  ],
  hyperdeck: [
    [52, 72, 152, 8],
    [52, 168, 152, 8],
    [52, 72, 8, 104],
    [196, 72, 8, 104],
    [72, 96, 80, 14],
    [72, 124, 112, 8],
    [72, 144, 96, 8]
  ],
  hyperplan: [
    [52, 68, 72, 22],
    [100, 106, 64, 22],
    [140, 144, 64, 22],
    [52, 186, 152, 6]
  ]
};

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function productIcon(product: ProductId, color: [number, number, number]): Buffer {
  const px = new Uint8Array(SIZE * SIZE * 4);
  const radius = 48;
  const set = (x: number, y: number, rgb: [number, number, number]) => {
    const i = (y * SIZE + x) * 4;
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = 255;
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const cx = x < radius ? radius : x >= SIZE - radius ? SIZE - radius - 1 : x;
      const cy = y < radius ? radius : y >= SIZE - radius ? SIZE - radius - 1 : y;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) set(x, y, color);
    }
  }
  for (const [rx, ry, rw, rh] of GLYPHS[product]) {
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) set(x, y, [255, 255, 255]);
  }
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}
