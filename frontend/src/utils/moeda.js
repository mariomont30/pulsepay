const formato = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatarMoeda(valor) { return formato.format(Number(valor)); }
