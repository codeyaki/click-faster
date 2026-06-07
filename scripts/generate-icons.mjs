import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const iconDir = path.join(rootDir, "icons");
const iconSizes = [16, 32, 48, 128];

fs.mkdirSync(iconDir, { recursive: true });

for (const size of iconSizes) {
  const png = createIconPng(size);
  fs.writeFileSync(path.join(iconDir, `icon-${size}.png`), png);
}

function createIconPng(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const color = colorForPixel(x + 0.5, y + 0.5, size, radius);
      pixels[index] = color[0];
      pixels[index + 1] = color[1];
      pixels[index + 2] = color[2];
      pixels[index + 3] = color[3];
    }
  }

  return encodePng(size, size, pixels);
}

function colorForPixel(x, y, size, radius) {
  if (!isInsideRoundedRect(x, y, size, size, radius)) {
    return [0, 0, 0, 0];
  }

  const background = [31, 122, 91, 255];
  const shadow = [18, 77, 62, 255];
  const highlight = [223, 244, 236, 255];
  const accent = [245, 194, 66, 255];

  if (isInsideTriangle(x, y, size)) {
    return highlight;
  }

  if (distanceToLine(x, y, size * 0.18, size * 0.35, size * 0.34, size * 0.35) <= Math.max(1, size * 0.035)) {
    return accent;
  }

  if (distanceToLine(x, y, size * 0.14, size * 0.49, size * 0.31, size * 0.49) <= Math.max(1, size * 0.035)) {
    return accent;
  }

  if (distanceToLine(x, y, size * 0.18, size * 0.63, size * 0.34, size * 0.63) <= Math.max(1, size * 0.035)) {
    return accent;
  }

  if (x > size * 0.07 && y > size * 0.72) {
    return shadow;
  }

  return background;
}

function isInsideRoundedRect(x, y, width, height, radius) {
  const closestX = clamp(x, radius, width - radius);
  const closestY = clamp(y, radius, height - radius);
  const dx = x - closestX;
  const dy = y - closestY;

  return dx * dx + dy * dy <= radius * radius;
}

function isInsideTriangle(x, y, size) {
  const a = { x: size * 0.42, y: size * 0.27 };
  const b = { x: size * 0.42, y: size * 0.73 };
  const c = { x: size * 0.77, y: size * 0.5 };
  const area = triangleArea(a, b, c);
  const areaSum = triangleArea({ x, y }, b, c) + triangleArea(a, { x, y }, c) + triangleArea(a, b, { x, y });

  return Math.abs(area - areaSum) < 0.5;
}

function triangleArea(a, b, c) {
  return Math.abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) / 2);
}

function distanceToLine(x, y, x1, y1, x2, y2) {
  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const t = clamp(((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared, 0, 1);
  const projectedX = x1 + t * (x2 - x1);
  const projectedY = y1 + t * (y2 - y1);

  return Math.hypot(x - projectedX, y - projectedY);
}

function encodePng(width, height, pixels) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0;
    pixels.copy(raw, y * rowLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createChunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    createChunk("IDAT", zlib.deflateSync(raw)),
    createChunk("IEND", Buffer.alloc(0))
  ]);
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const body = Buffer.concat([typeBuffer, data]);

  return Buffer.concat([
    uint32(data.length),
    body,
    uint32(crc32(body))
  ]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);

  return buffer;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
