const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/document.service');

const list = asyncHandler(async (req, res) => {
  const docs = await service.listDocuments();
  res.json(docs);
});

const getOne = asyncHandler(async (req, res) => {
  const doc = await service.getDocument(req.params.id);
  res.json(doc);
});

const create = asyncHandler(async (req, res) => {
  const doc = await service.createDocument(req.body);
  res.status(201).json(doc);
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteDocument(req.params.id);
  res.status(204).end();
});

module.exports = { list, getOne, create, remove };
