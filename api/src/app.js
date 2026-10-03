const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { env } = require('./config/env');
const routes = require('./routes');
const { notFound } = require('./middlewares/notFound');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: [env.clientUrl, 'http://localhost:4200', 'http://localhost:8080'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ name: 'sistema-gestion-documental-api', status: 'running' });
});

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
