export function maskPII(input = '') {
  if (!input) return '';
  return input
    .replace(/\b(\+?\d{2}\s?)?\d{6,}\b/g, '[TEL]')
    .replace(/\bNL\d{2}[A-Z]{4}\d{10}\b/gi, '[IBAN]')
    .replace(/\b\d{9}\b/g, '[BSN]');
}
