export function notFound(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

export function errorHandler(err, req, res, next) {
  // Don't leak details in production
  const isProd = process.env.NODE_ENV === 'production';

  console.error('[error]', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: isProd ? undefined : err.stack,
  });

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      error: err.message || 'Bad Request',
    });
  }

  res.status(500).json({
    error: isProd ? 'Internal server error' : err.message,
  });
}

export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[http] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}
