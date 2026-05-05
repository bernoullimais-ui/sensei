export const formacaoScores: Record<string, number> = {
  "Ensino Fundamental Completo": 40,
  "Ensino Médio Completo": 50,
  "Ensino Superior Incompleto": 75,
  "Ensino Superior Completo": 100,
  "Especialização": 150,
  "Mestrado": 200,
  "Doutorado": 300
};

export const eventosTypes = [
  "Seminários / Palestras (< 4 h)",
  "Cursos de Arbitragem / Técnicos / Pedagógicos / de Kata (>= 4 h)",
  "Credenciamento Técnico",
  "Auxiliar",
  "Ministrante (Seminários / Palestras) (< 4 h)",
  "Ministrante (Cursos de Arbitragem / Técnicos / Pedagógicos / de Kata) (>= 4 h)",
  "Cursos fora do periodo de carencia",
  "Demonstração de Kata em eventos oficiais",
  "Membros das comissões de Graus Estaduais (módulos com 04h00)"
];

export const eventosScores: Record<string, Record<string, number>> = {
  "Seminários / Palestras (< 4 h)": { "Regional": 20, "Estadual": 30, "Nacional": 50, "Internacional": 70 },
  "Cursos de Arbitragem / Técnicos / Pedagógicos / de Kata (>= 4 h)": { "Estadual": 70, "Nacional": 80, "Internacional": 100 },
  "Credenciamento Técnico": { "Estadual": 30 },
  "Auxiliar": { "Estadual": 20, "Nacional": 30, "Internacional": 40 },
  "Ministrante (Seminários / Palestras) (< 4 h)": { "Regional": 50, "Estadual": 80, "Nacional": 100, "Internacional": 120 },
  "Ministrante (Cursos de Arbitragem / Técnicos / Pedagógicos / de Kata) (>= 4 h)": { "Estadual": 90, "Nacional": 120, "Internacional": 140 },
  "Cursos fora do periodo de carencia": { "Nacional": 20, "Internacional": 30 },
  "Demonstração de Kata em eventos oficiais": { "Regional": 50, "Estadual": 80, "Nacional": 100, "Internacional": 120 },
  "Membros das comissões de Graus Estaduais (módulos com 04h00)": { "Estadual": 80, "Nacional": 100, "Internacional": 120 }
};

export const arbitroShiaiScores: Record<string, number> = {
  "Regional": 20,
  "Estadual": 30,
  "Nacional C": 40,
  "Nacional B": 50,
  "Nacional A": 60,
  "Aspirante Continental": 70,
  "FIJ C": 80,
  "FIJ B": 90,
  "FIJ A": 100
};

export const arbitroKataScores: Record<string, Record<string, number>> = {
  "Estadual": { "1": 5, "2": 10, "3": 20, "4": 30, "5": 40 },
  "Nacional": { "1": 20, "2": 30, "3": 40, "4": 50, "5": 60 },
  "Continental": { "1": 40, "2": 50, "3": 60, "4": 70, "5": 80 },
  "Internacional": { "1": 60, "2": 70, "3": 80, "4": 90, "5": 100 }
};

export const cargosTipos = [
  "Presidente de Federação Estadual",
  "Dirigente de Federação Estadual",
  "Presidente de Entidade",
  "Dirigente da CBJ",
  "Presidente da CBJ",
  "Membro de Banca Examinadora"
];

export const cargosScores: Record<string, { pts: number, isAnual: boolean }> = {
  "Presidente de Federação Estadual": { pts: 100, isAnual: true },
  "Dirigente de Federação Estadual": { pts: 80, isAnual: true },
  "Presidente de Entidade": { pts: 70, isAnual: true },
  "Dirigente da CBJ": { pts: 90, isAnual: true },
  "Presidente da CBJ": { pts: 130, isAnual: true },
  "Membro de Banca Examinadora": { pts: 60, isAnual: false }
};

export const competicoesAtletaTipos = [
  "Torneios locais homologados pela Federação Estadual",
  "Regional / Estadual / Seletiva Estadual",
  "Campeonato Estadual de Kata",
  "Brasileiro Regional",
  "Brasileiros",
  "Campeonato Brasileiro de Kata",
  "Sul-americano",
  "Pan-americano",
  "Circuito FIJ",
  "Ranking de Federação Estadual"
];

export const competicoesAtletaScores: Record<string, Record<string, number>> = {
  "Torneios locais homologados pela Federação Estadual": { "1º lugar": 10, "2º lugar": 10, "3º lugar": 10, "Participação": 10 },
  "Regional / Estadual / Seletiva Estadual": { "1º lugar": 50, "2º lugar": 40, "3º lugar": 30, "Participação": 10 },
  "Campeonato Estadual de Kata": { "1º lugar": 60, "2º lugar": 50, "3º lugar": 40, "Participação": 20 },
  "Brasileiro Regional": { "1º lugar": 70, "2º lugar": 60, "3º lugar": 50, "Participação": 20 },
  "Brasileiros": { "1º lugar": 80, "2º lugar": 70, "3º lugar": 60, "Participação": 30 },
  "Campeonato Brasileiro de Kata": { "1º lugar": 90, "2º lugar": 80, "3º lugar": 70, "Participação": 30 },
  "Sul-americano": { "1º lugar": 90, "2º lugar": 80, "3º lugar": 70, "Participação": 40 },
  "Pan-americano": { "1º lugar": 100, "2º lugar": 90, "3º lugar": 80, "Participação": 50 },
  "Circuito FIJ": { "1º lugar": 110, "2º lugar": 100, "3º lugar": 90, "Participação": 60 },
  "Ranking de Federação Estadual": { "1º lugar": 70, "2º lugar": 60, "3º lugar": 50 }
};

export const atuacaoCompeticoesTipos = [
  "Árbitro", "Coord. de Arbitragem", "Coord. de Evento", "Equipe de Apoio", "Técnico", "Auxiliar Técnico", "Médico"
];

export const atuacaoCompeticoesScores: Record<string, Record<string, number>> = {
  "Árbitro": { "Torneios locais": 15, "Regional/Estadual/Seletivas": 40, "Brasileiro Regional": 60, "Brasileiros": 70, "Internacionais": 90, "Circuito FIJ": 100 },
  "Coord. de Arbitragem": { "Regional/Estadual/Seletivas": 50, "Brasileiro Regional": 70, "Brasileiros": 80, "Internacionais": 100, "Circuito FIJ": 120 },
  "Coord. de Evento": { "Torneios locais": 20, "Regional/Estadual/Seletivas": 50, "Brasileiro Regional": 70, "Brasileiros": 80, "Internacionais": 100, "Circuito FIJ": 120 },
  "Equipe de Apoio": { "Torneios locais": 15, "Regional/Estadual/Seletivas": 30, "Brasileiro Regional": 50, "Brasileiros": 60, "Internacionais": 70, "Circuito FIJ": 80 },
  "Técnico": { "Regional/Estadual/Seletivas": 10, "Brasileiro Regional": 60, "Brasileiros": 70, "Internacionais": 90, "Circuito FIJ": 100 },
  "Auxiliar Técnico": { "Regional/Estadual/Seletivas": 5, "Brasileiro Regional": 15, "Brasileiros": 20, "Internacionais": 25, "Circuito FIJ": 30 },
  "Médico": { "Torneios locais": 20, "Regional/Estadual/Seletivas": 30, "Brasileiro Regional": 50, "Brasileiros": 60, "Internacionais": 70, "Circuito FIJ": 80 }
};

export const historicoForaCarenciaTipos = [
  "Medalhistas em Campeonato Estadual (geral ou kata)",
  "Medalhistas em Campeonato Brasileiro Regional (geral ou kata)",
  "Medalhistas em Campeonato Brasileiro (geral ou kata)",
  "Ministrante de Curso Estadual",
  "Ministrante de Curso Nacional",
  "Ministrante de Curso Internacional",
  "Dirigente de Federação Estadual",
  "Dirigente da CBJ"
];

export const historicoForaCarenciaScores: Record<string, {pts: number, isAnual: boolean}> = {
  "Medalhistas em Campeonato Estadual (geral ou kata)": {pts: 5, isAnual: false},
  "Medalhistas em Campeonato Brasileiro Regional (geral ou kata)": {pts: 7, isAnual: false},
  "Medalhistas em Campeonato Brasileiro (geral ou kata)": {pts: 10, isAnual: false},
  "Ministrante de Curso Estadual": {pts: 5, isAnual: false},
  "Ministrante de Curso Nacional": {pts: 7, isAnual: false},
  "Ministrante de Curso Internacional": {pts: 10, isAnual: false},
  "Dirigente de Federação Estadual": {pts: 10, isAnual: true},
  "Dirigente da CBJ": {pts: 15, isAnual: true}
};

export const producaoAcademicaTipos = [
  "Tese / Dissertação / Monografia",
  "Artigo Publicado em Revista Científica",
  "Revista/Apostila Oficial de Entidade (Federação Estadual ou CBJ)",
  "Publicação de Livro"
];

export const producaoAcademicaScores: Record<string, number> = {
  "Tese / Dissertação / Monografia": 50,
  "Artigo Publicado em Revista Científica": 70,
  "Revista/Apostila Oficial de Entidade (Federação Estadual ou CBJ)": 80,
  "Publicação de Livro": 80
};

export function getCarenciaAnos(grau: string): number {
  if (!grau) return 2;
  const match = grau.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (num === 1) return 2;
    if (num === 2) return 4;
    if (num === 3) return 5;
    if (num === 4) return 5;
    if (num === 5) return 6;
    if (num >= 6) return num + 1; // Fallback for higher dans if any
    return num;
  }
  return 2;
}

export function isAnoValid(ano: string, anoExame: number, carencia: number): boolean {
  if (!ano) return true; // Keep true when blank
  const numAno = parseInt(ano);
  if (isNaN(numAno)) return true;
  return numAno >= (anoExame - carencia + 1) && numAno <= anoExame;
}

export function getAnosValidosCargo(anoInicial: string, anoFinal: string, anoExame: number, carencia: number): number {
  const ini = parseInt(anoInicial);
  const fin = anoFinal ? parseInt(anoFinal) : ini;
  if (isNaN(ini)) return 0;
  if (isNaN(fin)) return 0; // Se preencheu inicial mas não final, fin == ini. Se não conseguiu parsear, 0.

  let validCount = 0;
  const carenciaIni = anoExame - carencia + 1;
  const carenciaFin = anoExame;
  
  for (let y = ini; y <= fin; y++) {
    if (y >= carenciaIni && y <= carenciaFin) {
      validCount++;
    }
  }
  return validCount;
}

