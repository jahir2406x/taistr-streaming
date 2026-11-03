export interface LegalSection {
  title: string;
  blocks: Array<
    | { type: 'p'; html: string }
    | { type: 'ul'; items: string[] }
    | { type: 'ol'; items: string[] }
    | { type: 'note'; text: string }
  >;
}

export interface ParsedLegalMarkdown {
  frontmatter: Record<string, string>;
  sections: LegalSection[];
}

function formatInlineBold(text: string, replacements: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, val).replaceAll(`{${key}}`, val);
  }
  return result.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="text-ink">$1</strong>'
  );
}

/**
 * Parsea los archivos editables `garantia.md` y `privacidad.md` de `src/editar/textos/`
 * convirtiendo cada `## Título` en una tarjeta idéntica al diseño original.
 */
export function parseLegalMarkdown(
  rawMd: string,
  replacements: Record<string, string> = {}
): ParsedLegalMarkdown {
  const normalized = rawMd.replace(/\r\n/g, '\n');
  const frontmatter: Record<string, string> = {};
  let body = normalized;

  if (normalized.startsWith('---\n')) {
    const endIdx = normalized.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      const fmBlock = normalized.slice(4, endIdx);
      body = normalized.slice(endIdx + 5);
      for (const line of fmBlock.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const k = line.slice(0, colonIdx).trim();
          const v = line
            .slice(colonIdx + 1)
            .trim()
            .replace(/^"(.*)"$/, '$1');
          frontmatter[k] = v;
        }
      }
    }
  }

  // Quitar comentarios HTML <!-- ... -->
  body = body.replace(/<!--[\s\S]*?-->/g, '').trim();

  const rawSections = body.split(/\n(?=##\s+)/);
  const sections: LegalSection[] = [];

  for (const rawSec of rawSections) {
    const lines = rawSec.trim().split('\n');
    const headingLine = lines.shift() || '';
    if (!headingLine.startsWith('## ')) continue;

    const title = headingLine.replace(/^##\s+/, '').trim();
    const blocks: LegalSection['blocks'] = [];
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (currentList) {
          blocks.push(currentList);
          currentList = null;
        }
        continue;
      }

      if (line.startsWith('- ')) {
        if (!currentList || currentList.type !== 'ul') {
          if (currentList) blocks.push(currentList);
          currentList = { type: 'ul', items: [] };
        }
        currentList.items.push(formatInlineBold(line.slice(2).trim(), replacements));
      } else if (/^\d+\.\s+/.test(line)) {
        if (!currentList || currentList.type !== 'ol') {
          if (currentList) blocks.push(currentList);
          currentList = { type: 'ol', items: [] };
        }
        currentList.items.push(
          formatInlineBold(line.replace(/^\d+\.\s+/, '').trim(), replacements)
        );
      } else if (line.startsWith('NOTA_PIE:')) {
        if (currentList) {
          blocks.push(currentList);
          currentList = null;
        }
        blocks.push({
          type: 'note',
          text: line.replace(/^NOTA_PIE:\s*/, '').trim(),
        });
      } else {
        if (currentList) {
          blocks.push(currentList);
          currentList = null;
        }
        blocks.push({
          type: 'p',
          html: formatInlineBold(line, replacements),
        });
      }
    }

    if (currentList) {
      blocks.push(currentList);
    }

    sections.push({ title, blocks });
  }

  return { frontmatter, sections };
}

