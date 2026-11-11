const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const autenticarToken = require('../middlewares/auth');
const limitarTentativas = require('../middlewares/limitarTentativas');

// Até 10 tentativas de login e 5 cadastros por IP a cada 15 minutos
const limiteLogin = limitarTentativas({ maximo: 10 });
const limiteCadastro = limitarTentativas({ maximo: 5 });

router.post('/registrar', limiteCadastro, authController.registrar);
router.post('/login', limiteLogin, authController.login);
router.post('/logout', authController.logout);
router.get('/me', autenticarToken, authController.me);

module.exports = router;
