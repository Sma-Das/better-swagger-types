import path from 'node:path';

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
}

export function toPascalCase(value: string): string {
  const normalized = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  if (!normalized) {
    return 'Generated';
  }

  return /^[A-Za-z_]/.test(normalized) ? normalized : `Schema${normalized}`;
}

export function sanitizeIdentifier(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.replace(/[^a-zA-Z0-9_]/g, '') || 'Generated';
}

export function makeEffectiveName(baseName: string, sourcePath: string, multipleMatches: boolean): string {
  if (!multipleMatches) {
    return baseName;
  }

  return `${baseName}-${path.basename(sourcePath, path.extname(sourcePath))}`;
}

export function makeNamespace(baseNamespace: string | undefined, effectiveName: string, sourcePath: string, multipleMatches: boolean): string {
  if (!multipleMatches) {
    return sanitizeIdentifier(baseNamespace ?? effectiveName);
  }

  const suffix = sanitizeIdentifier(path.basename(sourcePath, path.extname(sourcePath)));
  return sanitizeIdentifier(`${baseNamespace ?? effectiveName}${suffix}`);
}

export function makeFolderName(effectiveName: string): string {
  return toKebabCase(effectiveName);
}

export function buildOperationFallbackName(method: string, routePath: string): string {
  const segments = routePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return `By${toPascalCase(segment.slice(1, -1))}`;
      }

      return toPascalCase(segment);
    })
    .join('');

  const base = `${toPascalCase(method)}${segments || 'Root'}`;
  return sanitizeIdentifier(base);
}

export function buildSimplePathAliasBase(routePath: string): string {
  const groups: Array<{ base: string; modifiers: string[] }> = [];

  for (const segment of routePath.split('/').filter(Boolean)) {
    const parameterName = getPathParameterName(segment);
    if (parameterName) {
      const modifier = `By${formatSimpleAliasSegment(parameterName)}`;
      const currentGroup = groups[groups.length - 1];
      if (currentGroup) {
        currentGroup.modifiers.push(modifier);
      } else {
        groups.push({ base: 'Root', modifiers: [modifier] });
      }
      continue;
    }

    groups.push({
      base: formatSimpleAliasSegment(segment),
      modifiers: []
    });
  }

  const alias = (groups.length > 0 ? groups : [{ base: 'Root', modifiers: [] }])
    .slice()
    .reverse()
    .map((group) => `${group.base}${group.modifiers.join('')}`)
    .join('');

  return alias.endsWith('API') ? alias : `${alias}API`;
}

function getPathParameterName(segment: string): string | undefined {
  if (segment.startsWith('{') && segment.endsWith('}')) {
    const parameterName = segment.slice(1, -1).trim();
    return parameterName || undefined;
  }

  return undefined;
}

function formatSimpleAliasSegment(segment: string): string {
  if (/^api$/i.test(segment)) {
    return 'API';
  }

  if (/^v\d+$/i.test(segment)) {
    return `V${segment.slice(1)}`;
  }

  return toPascalCase(segment);
}
