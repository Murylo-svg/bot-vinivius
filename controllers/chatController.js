const { GoogleGenerativeAI } = require("@google/generative-ai");
const Mensagem = require("../models/Mensagem");
const Jogador = require("../models/Jogador");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODELO_CHAT = "gemini-flash-lite-latest";
const SALA_ADMINS = "admins"; // sala Socket.IO restrita a administradores (ver realtime/socket.js)

/**
 * REQ-004: lê o consumo REAL de tokens que o Gemini devolve em
 * result.response.usageMetadata.totalTokenCount (SDK @google/generative-ai 0.24.x).
 * Retorna null quando os metadados não vierem ou forem inválidos — nada é inventado.
 */
function extrairUsoDeTokens(result) {
    if (result && result.response && result.response.usageMetadata) {
        const total = result.response.usageMetadata.totalTokenCount;
        const entrada = result.response.usageMetadata.promptTokenCount;
        const saida = result.response.usageMetadata.candidatesTokenCount;

        if (Number.isInteger(total) && total >= 0) {
            return {
                total,
                entrada: Number.isInteger(entrada) && entrada >= 0 ? entrada : 0,
                saida: Number.isInteger(saida) && saida >= 0 ? saida : 0
            };
        }
    }
    console.warn("⚠️ Gemini não retornou usageMetadata.totalTokenCount válido; consumo não registrado.");
    return null;
}

// Combina o consumo das (no máximo duas) chamadas feitas para produzir UMA resposta:
// a chamada inicial e, se houver function calling, a chamada de retorno — ambas são cobradas.
function combinarUsos(usoInicial, usoFunctionCall) {
    if (!usoInicial) return usoFunctionCall || null;
    if (!usoFunctionCall) return usoInicial;
    return {
        total: usoInicial.total + usoFunctionCall.total,
        entrada: usoInicial.entrada + usoFunctionCall.entrada,
        saida: usoInicial.saida + usoFunctionCall.saida
    };
}

// Envia o consumo em tempo real SOMENTE para administradores autenticados.
// Falhas aqui nunca interrompem o chat.
function notificarAdmins(req, quantidade, mensagem) {
    try {
        const io = req.app.get("io");
        if (!io) return;
        io.to(SALA_ADMINS).emit("novoGastoDeToken", quantidade, {
            mensagemId: String(mensagem._id),
            criadoEm: mensagem.createdAt
        });
    } catch (err) {
        console.error("⚠️ Falha ao emitir novoGastoDeToken:", err.message);
    }
}

// Ferramenta de XP para a IA
const functions = {
    adicionarXP: async ({ nickname, quantidade }) => {
        console.log(`🎮 XP para ${nickname}: ${quantidade}`);
        const jogador = await Jogador.findOneAndUpdate(
            { nome: nickname },
            { $inc: { xp: quantidade } },
            { upsert: true, new: true }
        );
        return { sucesso: true, novoXP: jogador.xp };
    }
};

exports.enviarMensagem = async (req, res) => {
    try {
        const { pergunta, nickname } = req.body;
        if (!pergunta || !nickname) return res.status(400).json({ sucesso: false, erro: "Dados incompletos" });

        const model = genAI.getGenerativeModel({ 
            model: MODELO_CHAT,
            systemInstruction: `Você é o Mestre do Jogo. Proponha charadas de tecnologia para ${nickname}. 
            Se ele acertar, use 'adicionarXP' com 50. Se errar, use 'adicionarXP' com -10. 
            Seja épico e curto nas respostas.`
        }, {
            tools: [{
                functionDeclarations: [{
                    name: "adicionarXP",
                    description: "Adiciona XP ao jogador",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            nickname: { type: "string" },
                            quantidade: { type: "number" }
                        },
                        required: ["nickname", "quantidade"]
                    }
                }]
            }]
        });

        const chat = model.startChat();
        const result = await chat.sendMessage(pergunta);
        const response = result.response;
        const call = response.functionCalls()?.[0];
        
        let textoFinal = response.text();
        const usoInicial = extrairUsoDeTokens(result);
        let usoFunctionCall = null;

        if (call) {
            const apiResponse = await functions[call.name](call.args);
            const result2 = await chat.sendMessage([{
                functionResponse: { name: "adicionarXP", response: apiResponse }
            }]);
            textoFinal = result2.response.text();
            usoFunctionCall = extrairUsoDeTokens(result2);
        }

        const uso = combinarUsos(usoInicial, usoFunctionCall);

        await Mensagem.create({ role: 'user', text: pergunta });
        // O consumo fica associado APENAS à resposta da IA (um único registro por resposta)
        const mensagemIA = await Mensagem.create({
            role: 'model',
            text: textoFinal,
            tokensGastos: uso ? uso.total : 0,
            tokensEntrada: uso ? uso.entrada : 0,
            tokensSaida: uso ? uso.saida : 0,
            modelo: MODELO_CHAT
        });

        // Desafio extra: só emite quando há consumo válido E ele já foi persistido
        if (uso && uso.total > 0) {
            notificarAdmins(req, uso.total, mensagemIA);
        }

        res.json({ sucesso: true, resposta: textoFinal });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ sucesso: false, erro: erro.message });
    }
};

// ESSA FUNÇÃO NÃO PODE FALTAR:
exports.limparHistorico = async (req, res) => {
    try {
        await Mensagem.deleteMany({});
        res.json({ sucesso: true, mensagem: "Histórico limpo!" });
    } catch (erro) {
        res.status(500).json({ sucesso: false, erro: erro.message });
    }
};