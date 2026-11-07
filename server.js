const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/api.routes');
const adminRoutes = require('./routes/admin.routes');
const { initDatabase } = require('./init-db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', apiRoutes);

// Rutas de páginas HTML directas
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ruta de estado de salud del servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    system: 'Sistema de Licencias - Grupo Vealo',
  });
});

// Redirección para cualquier otra ruta no encontrada al inicio público
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
  });
});

// Iniciar servidor verificando la conexión a BD
async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Sistema de Licencias Grupo Vealo ONLINE`);
      console.log(`🌐 Portal Público:    http://localhost:${PORT}`);
      console.log(`🔐 Login Admin:       http://localhost:${PORT}/login`);
      console.log(`📊 Dashboard Admin:   http://localhost:${PORT}/admin`);
      console.log(`📱 API Verificación:  http://localhost:${PORT}/api/v1/license/check`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('No se pudo inicializar la base de datos PostgreSQL:', err.message);
    console.log('Intentando iniciar el servidor HTTP de todos modos...');
    app.listen(PORT, () => {
      console.log(`⚠️ Servidor iniciado en http://localhost:${PORT} (Revise conexión PostgreSQL)`);
    });
  }
}

startServer();
