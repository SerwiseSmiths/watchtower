// Strapi's Postgres migrations create an index with the exact same physical
// name as its paired FK constraint (legal in Postgres — indexes and
// constraints are different catalog objects there). Prisma's schema DSL
// requires `map` values to be unique per model regardless of object kind, so
// `prisma db pull` against strapi_console always re-introduces ~96 duplicate
// `map` errors. This strips the redundant `@@index` line in each case (the
// FK's own index coverage is unaffected — this only changes what Prisma
// tracks, not the actual database) so `prisma generate` can succeed.
// Run this after every `prisma db pull` against strapi_console.
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const src = fs.readFileSync(schemaPath, 'utf8');
const lines = src.split(/\r?\n/);

let out = [];
let i = 0;
let removed = 0;

while (i < lines.length) {
  const line = lines[i];
  if (/^model \w+ \{/.test(line)) {
    let block = [line];
    i++;
    while (i < lines.length && lines[i] !== '}') {
      block.push(lines[i]);
      i++;
    }
    block.push(lines[i]);
    i++;

    const relationMaps = new Set();
    for (const l of block) {
      const m = l.match(/@relation\([^)]*map:\s*"([^"]+)"/);
      if (m) relationMaps.add(m[1]);
    }

    const filtered = block.filter((l) => {
      const m = l.match(/^\s*@@index\(\[[^\]]+\],\s*map:\s*"([^"]+)"\)/);
      if (m && relationMaps.has(m[1])) {
        removed++;
        return false;
      }
      return true;
    });
    out.push(...filtered);
  } else {
    out.push(line);
    i++;
  }
}

fs.writeFileSync(schemaPath, out.join('\n'));
console.log(`Removed ${removed} redundant @@index lines colliding with relation FK names`);
