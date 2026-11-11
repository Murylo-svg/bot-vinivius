const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const autenticarToken = require('../middlewares/auth');

router.post('/registrar', authController.registrar);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', autenticarToken, authController.me);

module.exports = router;
