import { request, type IncomingMessage, type ServerResponse } from 'node:http'

export default function proxy(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost')
  const path = url.searchParams.get('path')
  url.searchParams.delete('path')
  if (!path || !path.startsWith('v1/')) {
    res.writeHead(404).end()
    return
  }

  const headers = { ...req.headers, host: '34.47.170.169' }
  delete headers.connection
  delete headers['transfer-encoding']
  delete headers['content-length']

  // Use a fixed upstream so this cannot act as an arbitrary forwarding proxy.
  const upstream = request({
    hostname: '34.47.170.169',
    port: 80,
    path: `/api/${path}${url.search}`,
    method: req.method,
    headers,
  }, (response) => {
    const responseHeaders = { ...response.headers, 'cache-control': 'no-store' }
    delete responseHeaders.connection
    delete responseHeaders['transfer-encoding']
    res.writeHead(response.statusCode || 502, responseHeaders)
    response.pipe(res)
    response.on('error', () => res.destroy())
  })

  upstream.setTimeout(120_000, () => upstream.destroy(new Error('Upstream timeout')))
  upstream.on('error', (error) => {
    console.error('API upstream connection failed:', error.message)
    if (res.headersSent) { res.destroy(); return }
    res.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ data: null, status: 'FAIL', message: 'Cannot connect to the API service.', error_code: 'UPSTREAM_CONNECTION_ERROR', description: null }))
  })
  req.on('aborted', () => upstream.destroy())

  if (req.body !== undefined) {
    upstream.end(Buffer.isBuffer(req.body) || typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
  } else {
    req.pipe(upstream)
  }
}
