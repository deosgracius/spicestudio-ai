// Tiny static server for local preview:  node serve.js  →  http://localhost:8791/
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 8791;
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);          // strip query (?v=… cache-busts)
  if (p === '/' || p === '') p = '/spicestudio-ai.html';       // default document
  const file = path.join(__dirname, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, {'content-type':'text/plain'}); res.end('404: ' + p); return; }
    res.writeHead(200, {'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(PORT, () => console.log('SpiceStudio serving at http://localhost:' + PORT + '/'));
