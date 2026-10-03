const repository = require('../repositories/document.repository');

async function listDocuments() {
  return repository.findAll();
}

async function getDocument(id) {
  const doc = await repository.findById(id);
  if (!doc) {
    const err = new Error('Documento no encontrado');
    err.statusCode = 404;
    throw err;
  }
  return doc;
}

async function createDocument(data) {
  if (!data || !data.title) {
    const err = new Error('El campo "title" es obligatorio');
    err.statusCode = 400;
    throw err;
  }
  return repository.create(data);
}

async function deleteDocument(id) {
  const deleted = await repository.remove(id);
  if (!deleted) {
    const err = new Error('Documento no encontrado');
    err.statusCode = 404;
    throw err;
  }
  return deleted;
}

module.exports = { listDocuments, getDocument, createDocument, deleteDocument };
