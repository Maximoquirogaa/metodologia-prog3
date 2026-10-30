export function resolveTenantIdentifier(req) {
  const headers = req.headers || {};
  const tenantId = headers['x-tenant-id'];
  const tenantSlug = headers['x-tenant-slug'];

  if (tenantId) {
    return { id: String(tenantId).trim() };
  }

  if (tenantSlug) {
    return { slug: String(tenantSlug).trim().toLowerCase() };
  }

  if (req.hostname && typeof req.hostname === 'string') {
    const parts = req.hostname.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      return { slug: parts[0].toLowerCase() };
    }
  }

  const defaultSlug = (process.env.TENANT_DEFAULT || 'demo').trim().toLowerCase();
  return { slug: defaultSlug };
}

export function tenantMiddleware(options = {}) {
  const resolver = options.resolver || resolveTenantIdentifier;

  return function (req, res, next) {
    try {
      const tenantIdent = resolver(req);
      req.tenant = tenantIdent;
      next();
    } catch (err) {
      next(err);
    }
  };
}
