export function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&', apos: "'", nbsp: ' ', quot: '"', lt: '<', gt: '>',
    eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â',
    ccedil: 'ç', icirc: 'î', ocirc: 'ô', ugrave: 'ù', ucirc: 'û',
    rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, token: string) => {
    if (token[0] === '#') {
      const code = token[1]?.toLowerCase() === 'x' ? Number.parseInt(token.slice(2), 16) : Number.parseInt(token.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : entity;
    }
    return named[token.toLowerCase()] ?? entity;
  });
}

/** Repair ANETI mojibake already persisted by the old importer. */
export function repairKnownCorruption(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/Op[\uFFFD?]rateur/gi, 'Opérateur'], [/Secr[\uFFFD?]taire/gi, 'Secrétaire'], [/M[\uFFFD?]canicien/gi, 'Mécanicien'],
    [/Ing[\uFFFD?]nieur/gi, 'Ingénieur'], [/R[\uFFFD?]gleur/gi, 'Régleur'], [/R[\uFFFD?]ceptionniste/gi, 'Réceptionniste'],
    [/D[\uFFFD?]coupeur/gi, 'Découpeur'], [/D[\uFFFD?]l[\uFFFD?]gu[\uFFFD?]/gi, 'Délégué'], [/R[\uFFFD?]dacteur/gi, 'Rédacteur'],
    [/T[\uFFFD?]l[\uFFFD?]conseiller/gi, 'Téléconseiller'], [/Contr[\uFFFD?]leur/gi, 'Contrôleur'], [/R[\uFFFD?]gisseur/gi, 'Régisseur'],
    [/Ergoth[\uFFFD?]rapeute/gi, 'Ergothérapeute'], [/Kin[\uFFFD?]sit[\uFFFD?]rapeute/gi, 'Kinésithérapeute'], [/Di[\uFFFD?]t[\uFFFD?]ticien/gi, 'Diététicien'],
    [/Pr[\uFFFD?]parateur/gi, 'Préparateur'], [/Pl[\uFFFD?]trier/gi, 'Plâtrier'], [/P[\uFFFD?]tissier/gi, 'Pâtissier'],
    [/Educateur Sp[\uFFFD?]cialis[\uFFFD?]/gi, 'Éducateur Spécialisé'], [/Educateur d'activit[\uFFFD?]s/gi, 'Éducateur d’activités'],
    [/activit[\uFFFD?]s/gi, 'activités'], [/Activit[\uFFFD?]s/gi, 'Activités'], [/qualit[\uFFFD?]/gi, 'qualité'],
    [/Qualit[\uFFFD?]/gi, 'Qualité'], [/s[\uFFFD?]curit[\uFFFD?]/gi, 'sécurité'], [/S[\uFFFD?]curit[\uFFFD?]/gi, 'Sécurité'],
    [/[\uFFFD?]lectricit[\uFFFD?]/gi, 'électricité'], [/[\uFFFD?]lectrique/gi, 'électrique'], [/[\uFFFD?]lectronique/gi, 'électronique'],
    [/[\uFFFD?]quipement/gi, 'équipement'], [/[\uFFFD?]cole/gi, 'école'], [/[\uFFFD?]tudes/gi, 'études'],
    [/automatis[\uFFFD?]e/gi, 'automatisée'], [/m[\uFFFD?]dicale/gi, 'médicale'], [/mat[\uFFFD?]riaux/gi, 'matériaux'],
    [/contr[\uFFFD?]le/gi, 'contrôle'], [/d[\uFFFD?]installation/gi, 'd’installation'], [/d[\uFFFD?]enfant/gi, 'd’enfant'],
    [/B[\uFFFD?]timent/gi, 'Bâtiment'], [/m[\uFFFD?]canique/gi, 'mécanique'], [/d[\uFFFD?]art/gi, 'd’art'],
    [/fa[\uFFFD?]onnage/gi, 'façonnage'], [/R[\uFFFD?]gleur/gi, 'Régleur'], [/d[\uFFFD?]quipement/gi, 'd’équipement'],
    [/jardin d[\uFFFD?]enfant/gi, 'jardin d’enfant'], [/Cr[\uFFFD?]pier/gi, 'Crêpier'], [/Num[\uFFFD?]rique/gi, 'Numérique'],
    [/m[\uFFFD?]thodes/gi, 'méthodes'], [/m[\uFFFD?]dico/gi, 'médico'], [/Interm[\uFFFD?]diaire/gi, 'Intermédiaire'],
    [/sp[\uFFFD?]cialis[\uFFFD?]/gi, 'spécialisé'], [/[\uFFFD?]nerg[\uFFFD?]tique/gi, 'énergétique'], [/anest[\uFFFD?]siste/gi, 'anesthésiste'],
    [/op[\uFFFD?]ratoire/gi, 'opératoire'], [/Rev[\uFFFD?]tements/gi, 'Revêtements'], [/soci[\uFFFD?]t[\uFFFD?]/gi, 'société'],
    [/d[\uFFFD?]unit[\uFFFD?]/gi, 'd’unité'], [/d[\uFFFD?]engins/gi, 'd’engins'], [/d[\uFFFD?]ameublement/gi, 'd’ameublement'],
    [/d[\uFFFD?]analyse/gi, 'd’analyse'], [/d[\uFFFD?]assemblage et d[\uFFFD?]emballage manuel/gi, 'd’assemblage et d’emballage manuel'],
    [/M[\uFFFD?]nage/gi, 'Ménage'], [/R[\uFFFD?]seaux/gi, 'Réseaux'], [/m[\uFFFD?]taux/gi, 'métaux'], [/mat[\uFFFD?]riels/gi, 'matériels'],
    [/g[\uFFFD?]n[\uFFFD?]raux/gi, 'généraux'], [/cha[\uFFFD?]ne/gi, 'chaîne'], [/Charg[\uFFFD?]/gi, 'Chargé'], [/Op[\uFFFD?]rations/gi, 'Opérations'],
    [/Client[\uFFFD?]le/gi, 'Clientèle'], [/vid[\uFFFD?]o/gi, 'vidéo'], [/P[\uFFFD?]pini[\uFFFD?]riste/gi, 'Pépiniériste'], [/int[\uFFFD?]rieur/gi, 'intérieur'],
    [/d[\uFFFD?]coupage/gi, 'découpage'], [/[\uFFFD?]nergies/gi, 'énergies'], [/c[\uFFFD?]bleur/gi, 'câbleur'], [/[\uFFFD?]lectrotechnique/gi, 'électrotechnique'],
    [/Num[\uFFFD?]rique [\uFFFD?] CN/gi, 'Numérique à CN'], [/d[\uFFFD?]assemblage/gi, 'd’assemblage'], [/March[\uFFFD?]s/gi, 'Marchés'],
    [/sant[\uFFFD?]/gi, 'santé'], [/unit[\uFFFD?]/gi, 'unité'], [/Employ[\uFFFD?]/gi, 'Employé'], [/m[\uFFFD?]tallique/gi, 'métallique'],
    [/v[\uFFFD?]hicules/gi, 'véhicules'], [/Proth[\uFFFD?]siste/gi, 'Prothésiste'], [/R[\uFFFD?]glement/gi, 'Règlement'], [/Ma[\uFFFD?]on/gi, 'Maçon'],
    [/mod[\uFFFD?]liste/gi, 'modéliste'], [/h[\uFFFD?]tel/gi, 'hôtel'], [/m[\uFFFD?]dical/gi, 'médical'], [/p[\uFFFD?]trochimique/gi, 'pétrochimique'],
    [/T[\uFFFD?]l[\uFFFD?]Op[\uFFFD?]rateur/gi, 'TéléOpérateur'], [/g[\uFFFD?]n[\uFFFD?]ral/gi, 'général'], [/Esth[\uFFFD?]ticien/gi, 'Esthéticien'],
    [/sp[\uFFFD?]cials[\uFFFD?]/gi, 'spécialisé'], [/pr[\uFFFD?]vention/gi, 'prévention'],
    [/[\uFFFD?] CN/gi, 'à CN'], [/T[\uFFFD?]l[\uFFFD?]Op[\uFFFD?]rateur/gi, 'TéléOpérateur'], [/T[\uFFFD?]l[\uFFFD?]Opérateur/gi, 'TéléOpérateur'],
    [/c[\uFFFD?]ramique/gi, 'céramique'], [/m[\uFFFD?]lange/gi, 'mélange'], [/d'[\uFFFD?]tablissement/gi, 'd’établissement'], [/priv[\uFFFD?]e/gi, 'privée'],
    [/[\uFFFD?] bois/gi, 'à bois'], [/G[\uFFFD?]ologue/gi, 'Géologue'], [/T[\uFFFD?]lier/gi, 'Tôlier'], [/Menuis[\uFFFD?]es/gi, 'Menuisées'],
    [/Imp[\uFFFD?]ts/gi, 'Impôts'], [/Hydroth[\uFFFD?]rapeute/gi, 'Hydrothérapeute'], [/D[\uFFFD?]chets/gi, 'Déchets'], [/P[\uFFFD?]dagogique/gi, 'Pédagogique'],
    [/d'[\uFFFD?]quipe/gi, 'd’équipe'], [/man[\uFFFD?]ge/gi, 'manège'], [/B[\uFFFD?]ton/gi, 'Béton'], [/d[\uFFFD?]coration/gi, 'décoration'],
    [/diff[\uFFFD?]rents/gi, 'différents'], [/a[\uFFFD?]rien/gi, 'aérien'],
    [/ambulancier[\uFFFD?]/gi, 'ambulancier'], [/G[\uFFFD?]rant/gi, 'Gérant'], [/pr[\uFFFD?]paration/gi, 'préparation'], [/efficacit[\uFFFD?]/gi, 'efficacité'],
    [/p[\uFFFD?]te/gi, 'pâte'], [/[\uFFFD?] papier/gi, 'à papier'], [/d[\uFFFD?]veloppement/gi, 'développement'],
  ];
  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

export function decodeSourceBuffer(buffer: ArrayBuffer, contentType = ''): string {
  const bytes = new Uint8Array(buffer);
  const probe = new TextDecoder('latin1').decode(bytes.slice(0, 4096));
  const declared = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]
    || probe.match(/<meta[^>]+charset\s*=\s*["']?([^\s"'>]+)/i)?.[1]
    || probe.match(/<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^;"']+)/i)?.[1]
    || 'utf-8';
  const decode = (charset: string) => {
    try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder('utf-8').decode(bytes); }
  };
  const decoded = decode(declared);
  if (!decoded.includes('\uFFFD')) return repairKnownCorruption(decoded);
  const fallback = decode('windows-1252');
  return repairKnownCorruption((fallback.match(/\uFFFD/g)?.length ?? 0) < (decoded.match(/\uFFFD/g)?.length ?? 0) ? fallback : decoded);
}

export function htmlText(value: string): string {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function sourceDate(value: string): Date | null {
  const match = value.match(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{4})\b/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeSourceUrl(raw: string, base: string, allowedHost: string): string | null {
  try {
    const url = new URL(decodeHtml(raw), base);
    return url.protocol === 'https:' && url.hostname === allowedHost ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchPublicHtml(url: URL, allowedHost: string): Promise<string> {
  if (url.protocol !== 'https:' || url.hostname !== allowedHost) throw new Error('Public source host is not allowed');
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': 'EasyJob/1.0 (public job listing aggregator)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok || new URL(response.url).hostname !== allowedHost) throw new Error(`Public source responded with ${response.status}`);
  const html = decodeSourceBuffer(await response.arrayBuffer(), response.headers.get('content-type') || '');
  if (html.length > 12_000_000) throw new Error('Public source response exceeded the indexing limit');
  return html;
}
