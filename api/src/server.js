const { app } = require('./app');
const { env } = require('./config/env');
const { connectDB } = require('./config/db');

async function start() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      console.log(`API escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    console.error('Error al iniciar el servidor:', err.message);
    process.exit(1);
  }
}

start();
