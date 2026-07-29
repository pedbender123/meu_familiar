const janela = 60_000;
const limite = 10;
const contagens = new Map<string, { count: number; expiraEm: number }>();

export function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const registro = contagens.get(ip);
  if (!registro || registro.expiraEm < agora) {
    contagens.set(ip, { count: 1, expiraEm: agora + janela });
    return false;
  }
  registro.count += 1;
  return registro.count > limite;
}
