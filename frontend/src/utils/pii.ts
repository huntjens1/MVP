export function maskPII(input: string): { masked: string; flagged: boolean } {
  let flagged = false;
  let out = input;

  // E-mailadressen
  out = out.replace(
    /([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (_: string, a: string, b: string, domain: string) => {
      flagged = true;
      const star = b.replace(/./g, "•");
      return `${a}${star}${domain}`;
    }
  );

  // Telefoonnummers
  out = out.replace(/\b(\+?\d{1,3}[-.\s]?)?(\d{2,4}[-.\s]?){2,4}\d\b/g, (match) => {
    flagged = true;
    return match.replace(/\d/g, "•");
  });

  // IBAN (ruwe detectie)
  out = out.replace(/\b([A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,})\b/g, (match) => {
    flagged = true;
    return match.slice(0, 4) + "•••• •••• •••• ••••";
  });

  return { masked: out, flagged };
}
