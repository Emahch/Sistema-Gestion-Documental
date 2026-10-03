const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    path: { type: String, default: '/' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Document = mongoose.model('Document', documentSchema);

async function findAll() {
  return Document.find().sort({ createdAt: -1 }).lean();
}

async function findById(id) {
  return Document.findById(id).lean();
}

async function create(data) {
  const doc = new Document(data);
  return doc.save();
}

async function remove(id) {
  return Document.findByIdAndDelete(id);
}

module.exports = { Document, findAll, findById, create, remove };
