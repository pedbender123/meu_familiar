export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

export function validarCpf(cpfEntrada: string): boolean {
  const cpf = somenteDigitos(cpfEntrada);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calcularDigito(cpf.slice(0, 9), 10);
  const digito2 = calcularDigito(cpf.slice(0, 10), 11);

  return digito1 === parseInt(cpf[9], 10) && digito2 === parseInt(cpf[10], 10);
}

export function validarNome(nome: string): boolean {
  const limpo = nome.trim();
  return limpo.length > 0 && limpo.length <= 40 && !/[<>]/.test(limpo);
}
