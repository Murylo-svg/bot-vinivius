const { Server } = require('socket.io');
const { verificarTokenEObterUsuario } = require('../middlewares/auth');

const SALA_ADMINS = 'admins';

/**
 * Servidor Socket.IO acoplado ao MESMO servidor HTTP do Express (sem segunda porta).
 * - Toda conexão precisa de um JWT válido em handshake.auth.token.
 * - Apenas quem tem role "admin" NO BANCO entra na sala "admins",
 *   que é a única que recebe o evento administrativo "novoGastoDeToken".
 */
function configurarSocket(httpServer) {
    const io = new Server(httpServer);

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth && socket.handshake.auth.token;
            const usuario = await verificarTokenEObterUsuario(token);
            if (!usuario) return next(new Error('nao_autenticado'));
            socket.data.usuario = usuario;
            return next();
        } catch (err) {
            return next(new Error('erro_autenticacao'));
        }
    });

    io.on('connection', (socket) => {
        const { usuario } = socket.data;
        if (usuario.role === 'admin') {
            socket.join(SALA_ADMINS);
        }
        socket.emit('sessao', { role: usuario.role, salaAdmin: usuario.role === 'admin' });
    });

    return io;
}

module.exports = { configurarSocket, SALA_ADMINS };
