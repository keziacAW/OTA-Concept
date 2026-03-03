export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let response;

    if (url.pathname === '/check-update' && request.method === 'GET')
      response = await handleCheckUpdate(request, env);
    else if (url.pathname.startsWith('/download/') && request.method === 'GET')
      response = await handleDownload(request, env);
    else if (url.pathname === '/upload' && request.method === 'POST')
      response = await handleUpload(request, env);
    else if (url.pathname === '/releases' && request.method === 'GET')
      response = await handleListReleases(request, env);
    else
      response = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

    Object.entries(corsHeaders).forEach(([key, val]) => response.headers.set(key, val));
    return response;
  }
};

/**
 * GET /check-update?appVersion=3.5.29&bundleVersion=0
 */
async function handleCheckUpdate(request, env) {
  const url = new URL(request.url);
  const currentBundleVersion = parseInt(url.searchParams.get('bundleVersion') || '0');
  const appVersion = url.searchParams.get('appVersion');

  if (!appVersion) {
    return Response.json({ error: 'appVersion is required' }, { status: 400 });
  }

  const metadata = await env.OTA_METADATA.get('current', 'json');

  if (!metadata) {
    return Response.json({ shouldUpdate: false });
  }

  const isTargeted = metadata.targetAppVersions.includes(appVersion);
  const shouldUpdate = isTargeted && currentBundleVersion < metadata.bundleVersion;

  return Response.json({
    shouldUpdate,
    bundleVersion: shouldUpdate ? metadata.bundleVersion : currentBundleVersion,
    downloadURL: shouldUpdate ? `${url.origin}/download/${metadata.bundleVersion}` : null,
    isMandatory: shouldUpdate ? metadata.isMandatory : false,
    releasedAt: metadata.releasedAt,
  });
}

/**
 * GET /download/:bundleVersion
 * Returns the raw bundle.js file.
 */
async function handleDownload(request, env) {
  const version = new URL(request.url).pathname.split('/').pop();
  const object = await env.OTA_BUNDLES.get(`bundle-${version}.js`);

  if (!object) {
    return Response.json({ error: `Bundle v${version} not found` }, { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/javascript',
      'Content-Disposition': `attachment; filename="bundle.js"`,
    }
  });
}

/**
 * POST /upload
 * Headers: X-Upload-Key: <secret>
 * Body (multipart form):
 *   - bundle: bundle.js file
 *   - bundleVersion: number (e.g. "1")
 *   - targetAppVersions: JSON array (e.g. '["3.5.29"]')
 *   - isMandatory: "true" | "false"
 */
async function handleUpload(request, env) {
  const authKey = request.headers.get('X-Upload-Key');
  if (authKey !== env.UPLOAD_SECRET_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const bundle = formData.get('bundle');
  const bundleVersion = formData.get('bundleVersion');
  const targetAppVersions = JSON.parse(formData.get('targetAppVersions') || '[]');
  const isMandatory = formData.get('isMandatory') === 'true';

  if (!bundle || !bundleVersion || targetAppVersions.length === 0) {
    return Response.json({ error: 'bundle, bundleVersion, and targetAppVersions are required' }, { status: 400 });
  }

  // Store raw bundle.js in R2
  await env.OTA_BUNDLES.put(`bundle-${bundleVersion}.js`, bundle);

  // Update metadata in KV
  await env.OTA_METADATA.put('current', JSON.stringify({
    bundleVersion: parseInt(bundleVersion),
    targetAppVersions,
    isMandatory,
    releasedAt: new Date().toISOString(),
  }));

  return Response.json({ success: true, bundleVersion, targetAppVersions, isMandatory });
}

/**
 * GET /releases
 * Headers: X-Upload-Key: <secret>
 */
async function handleListReleases(request, env) {
  const authKey = request.headers.get('X-Upload-Key');
  if (authKey !== env.UPLOAD_SECRET_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metadata = await env.OTA_METADATA.get('current', 'json');
  return Response.json(metadata || { message: 'No releases yet' });
}
