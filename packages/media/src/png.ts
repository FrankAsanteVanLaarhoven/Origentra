/**
 * Minimal, dependency-free PNG codec (decode + encode) using node:zlib.
 *
 * Supported: 8-bit depth, non-interlaced, colour types 0 (grey), 2 (RGB),
 * 4 (grey+alpha), 6 (RGBA). This is enough to obtain real pixels from real PNGs
 * for perceptual hashing, and to synthesise test images. Unsupported inputs
 * throw a clear error rather than returning wrong pixels (see docs/LIMITATIONS).
 *
 * JPEG/WebP/AVIF decoding (and video/audio) are intentionally out of scope for
 * this milestone; the perceptual-hash algorithm below is format-agnostic once
 * pixels exist, so those decoders slot in without touching the hash.
 */

import { deflateSync, inflateSync } from 'node:zlib';

export interface RawImage {
  width: number;
  height: number;
  channels: 1 | 2 | 3 | 4;
  data: Uint8Array; // row-major, 8-bit per channel
}

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function channelsOf(colorType: number): 1 | 2 | 3 | 4 {
  switch (colorType) {
    case 0: return 1;
    case 2: return 3;
    case 4: return 2;
    case 6: return 4;
    default: throw new Error(`png: unsupported colour type ${colorType}`);
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(buffer: Buffer): RawImage {
  if (!buffer.subarray(0, 8).equals(SIG)) throw new Error('png: bad signature');
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels: 1 | 2 | 3 | 4 = 4;
  const idat: Buffer[] = [];

  while (pos < buffer.length) {
    const len = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8]!;
      const colorType = data[9]!;
      const interlace = data[12]!;
      if (bitDepth !== 8) throw new Error(`png: only 8-bit depth supported (got ${bitDepth})`);
      if (interlace !== 0) throw new Error('png: interlaced images not supported');
      channels = channelsOf(colorType);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const rowStart = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rowStart + x]!;
      const a = x >= channels ? out[y * stride + x - channels]! : 0;
      const b = y > 0 ? out[(y - 1) * stride + x]! : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels]! : 0;
      let val: number;
      switch (filter) {
        case 0: val = rawByte; break;
        case 1: val = rawByte + a; break;
        case 2: val = rawByte + b; break;
        case 3: val = rawByte + ((a + b) >> 1); break;
        case 4: val = rawByte + paeth(a, b, c); break;
        default: throw new Error(`png: unknown filter ${filter}`);
      }
      out[y * stride + x] = val & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/** Encode an image as a non-interlaced 8-bit PNG (filter 0 on every row). */
export function encodePng(img: RawImage): Buffer {
  const colorType = img.channels === 1 ? 0 : img.channels === 2 ? 4 : img.channels === 3 ? 2 : 6;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = img.width * img.channels;
  const rawFiltered = Buffer.alloc(img.height * (stride + 1));
  for (let y = 0; y < img.height; y++) {
    rawFiltered[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < stride; x++) rawFiltered[y * (stride + 1) + 1 + x] = img.data[y * stride + x]!;
  }
  const idat = deflateSync(rawFiltered);
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
