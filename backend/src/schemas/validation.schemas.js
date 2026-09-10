const { z } = require("zod");

const registroSchema = z.object({
  nome: z.string().min(3, "Nome deve ter ao menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  cpf: z
    .string()
    .regex(/^\d{11}$/, "CPF fictício deve conter 11 dígitos numéricos"),
  senha: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

// Aceita transferir tanto pelo UUID interno da conta (útil para testes via
// API/Postman) quanto pelo e-mail do destinatário (fluxo usado pelo
// frontend, muito mais prático para o usuário final testar manualmente).
const transferenciaSchema = z
  .object({
    contaDestinoId: z.string().uuid("contaDestinoId deve ser um UUID válido").optional(),
    emailDestino: z.string().email("emailDestino inválido").optional(),
    valor: z
      .number({ invalid_type_error: "valor deve ser numérico" })
      .positive("valor deve ser maior que zero"),
  })
  .refine((dados) => Boolean(dados.contaDestinoId || dados.emailDestino), {
    message: "Informe contaDestinoId ou emailDestino",
    path: ["emailDestino"],
  });

module.exports = { registroSchema, loginSchema, transferenciaSchema };