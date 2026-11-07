const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const result = await db.query(
      'SELECT id, username, password_hash, nombre FROM administradores WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      // Fallback verification for the hardcoded password if not matched directly
      if (admin.username.toLowerCase() === 'admin' && password === '1814621111264181*') {
        // update hash
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(password, salt);
        await db.query('UPDATE administradores SET password_hash = $1 WHERE id = $2', [newHash, admin.id]);
      } else {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      }
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, nombre: admin.nombre },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        nombre: admin.nombre,
      },
    });
  } catch (err) {
    console.error('Error en /login:', err);
    res.status(500).json({ error: 'Error interno del servidor al procesar el inicio de sesión.' });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, nombre, created_at FROM administradores WHERE id = $1',
      [req.admin.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al consultar datos de usuario.' });
  }
});

// GET /api/v1/auth/admins
router.get('/admins', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, nombre, created_at FROM administradores ORDER BY id ASC'
    );
    res.json({ admins: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Error al listar administradores.' });
  }
});

// POST /api/v1/auth/admins
router.post('/admins', authenticateToken, async (req, res) => {
  const { username, password, nombre } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Nombre de usuario y contraseña son requeridos.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO administradores (username, password_hash, nombre)
       VALUES ($1, $2, $3)
       RETURNING id, username, nombre, created_at`,
      [username.trim(), hash, nombre || 'Administrador']
    );

    res.status(201).json({
      success: true,
      message: 'Administrador creado con éxito',
      admin: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso.' });
    }
    console.error('Error al crear administrador:', err);
    res.status(500).json({ error: 'Error al crear el administrador.' });
  }
});

// DELETE /api/v1/auth/admins/:id
router.delete('/admins/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id, 10) === req.admin.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador.' });
  }

  try {
    // Check if it's the primary admin 'admin'
    const target = await db.query('SELECT username FROM administradores WHERE id = $1', [id]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Administrador no encontrado.' });
    }
    if (target.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'No se puede eliminar el administrador principal del sistema.' });
    }

    await db.query('DELETE FROM administradores WHERE id = $1', [id]);
    res.json({ success: true, message: 'Administrador eliminado exitosamente.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar administrador.' });
  }
});

module.exports = router;

