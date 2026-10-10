const fs = require('fs');
const path = require('path');
const { connectDB, mongoose } = require('../config/db');
const { User } = require('../models/user.model');
const { Folder } = require('../models/folder.model');
const { File } = require('../models/file.model');
const { Share } = require('../models/share.model');
const { ActivityLog } = require('../models/activity-log.model');

const MODELS = [User, Folder, File, Share, ActivityLog];

const RELATIONS = [
  ['files', 'ownerId', 'users'],
  ['files', 'folderId', 'folders'],
  ['folders', 'ownerId', 'users'],
  ['folders', 'createdBy', 'users'],
  ['folders', 'parentId', 'folders'],
  ['shares', 'ownerId', 'users'],
  ['shares', 'sharedWithId', 'users'],
  ['shares', 'resourceId', 'files|folders'],
  ['activity_logs', 'userId', 'users'],
  ['activity_logs', 'resourceId', 'files|folders|users'],
];

function mermaidType(instance) {
  switch (instance) {
    case 'ObjectId':
      return 'ObjectId';
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Date':
      return 'date';
    case 'Array':
      return 'array';
    case 'Mixed':
      return 'object';
    default:
      return 'string';
  }
}

function describeSchema(model) {
  return Object.entries(model.schema.paths)
    .filter(([name]) => name !== '__v')
    .map(([name, type]) => {
      const label = type.$isMongooseDocumentArray ? `${mermaidType('ObjectId')}[]` : mermaidType(type.instance);
      return `        ${label} ${name}${name === '_id' ? ' PK' : ''}`;
    })
    .join('\n');
}

function describeIndex(index) {
  const keys = Object.entries(index.key)
    .map(([field, order]) => `${field}:${order}`)
    .join(', ');
  const flags = [];
  if (index.unique) flags.push('unique');
  if (index.partialFilterExpression) flags.push(`partial ${JSON.stringify(index.partialFilterExpression)}`);
  return `- \`{ ${keys} }\`${flags.length ? ` (${flags.join(', ')})` : ''}`;
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  const lines = [];
  lines.push('# Diagrama ER (generado contra la base viva)');
  lines.push('');
  lines.push(`_Base: \`${db.databaseName}\` · generado: ${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}_`);
  lines.push('');
  lines.push('```mermaid');
  lines.push('erDiagram');
  for (const model of MODELS) {
    lines.push(`    ${model.collection.name} {`);
    lines.push(describeSchema(model));
    lines.push('    }');
  }
  for (const [from, field, to] of RELATIONS) {
    lines.push(`    ${from} }o--|| ${to.split('|')[0]} : "${field}"`);
  }
  lines.push('```');
  lines.push('');
  lines.push('## Índices por colección');
  for (const model of MODELS) {
    const name = model.collection.name;
    const count = await db.collection(name).countDocuments();
    const indexes = await db.collection(name).indexes();
    lines.push('');
    lines.push(`### \`${name}\` (${count} documentos)`);
    lines.push('');
    for (const index of indexes) {
      lines.push(describeIndex(index));
    }
  }
  lines.push('');
  await mongoose.disconnect();
  const output = path.join(__dirname, '..', '..', '..', 'docs', 'erd.md');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, lines.join('\n'));
  console.log(`Diagrama escrito en ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
