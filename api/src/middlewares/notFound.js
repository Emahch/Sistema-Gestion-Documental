function notFound(req, res, next) {
  res.status(404).json({ message: `Ruta no encontrada: ${req.originalUrl}` });
}

module.exports = { notFound };
