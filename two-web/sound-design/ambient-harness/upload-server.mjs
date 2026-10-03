import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = process.argv[2]; fs.mkdirSync(dir, { recursive: true });
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const name = new URL(req.url, 'http://x').searchParams.get('name') || 'out';
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => { fs.writeFileSync(path.join(dir, name.replace(/[^\w-]/g, '_') + '.wav'), Buffer.concat(chunks)); res.end('ok'); });
}).listen(8960, () => console.log('upload server on 8960'));
