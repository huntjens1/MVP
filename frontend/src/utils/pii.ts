// frontend/src/utils/pii.ts
export function maskPII(text: string): { masked: string; flagged: boolean } {
  let masked = text;
  const patterns: RegExp[] = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // email
    /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g, // tel
    /\b[0-9]{9}\b/g, // bsn-achtig
  ];
  let flagged = false;
  for (const re of patterns) {
    if (re.test(masked)) {
      flagged = true;
      masked = masked.replace(re, "[GEMASKERD]");
    }
  }
  return { masked, flagged };
}
