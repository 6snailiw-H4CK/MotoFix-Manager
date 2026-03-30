/**
 * Utilitários para normalização de telefones no padrão brasileiro.
 */
export const PhoneUtils = {
  /**
   * Converte qualquer string de telefone para o formato 55DDD9XXXXXXXX.
   * Remove caracteres não numéricos e garante o prefixo 55.
   */
  normalizeToBrazil: (rawPhone: string): string => {
    if (!rawPhone) return '';
    
    // Remove tudo que não for número
    let phone = rawPhone.replace(/\D/g, '');
    
    if (!phone) return '';

    // Se já tem 55 no início e 12 ou 13 dígitos, assume-se correto
    if (phone.startsWith('55') && (phone.length === 12 || phone.length === 13)) {
      return phone;
    }

    // Se tem 10 ou 11 dígitos (DDD + Número), adiciona 55
    if (phone.length === 10 || phone.length === 11) {
      return '55' + phone;
    }

    // Caso de números com 8 ou 9 dígitos sem DDD (não recomendado, mas tenta tratar)
    // Aqui assume-se que o banco deve ter o DDD. Se não tiver, retorna o que tem.
    return phone;
  }
};
