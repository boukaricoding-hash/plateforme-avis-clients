import { describe, expect, it } from "vitest";
import {
  hacherMotDePasse,
  validerMotDePasse,
  verifierMotDePasse,
} from "../../src/modules/authentification/services/mots-de-passe";

describe("validerMotDePasse", () => {
  it("accepte un mot de passe correct", () => {
    expect(validerMotDePasse("Soleil-Togo-2026").valide).toBe(true);
  });

  it("refuse un mot de passe de moins de 8 caracteres", () => {
    expect(validerMotDePasse("abc123").valide).toBe(false);
  });

  it("refuse un mot de passe trop courant, meme en majuscules", () => {
    expect(validerMotDePasse("PASSWORD").valide).toBe(false);
    expect(validerMotDePasse("azerty123").valide).toBe(false);
  });

  it("refuse un mot de passe identique a l'adresse e-mail", () => {
    const email = "responsable@demo.tg";
    expect(validerMotDePasse(email, email).valide).toBe(false);
  });

  it("refuse un mot de passe de plus de 72 caracteres", () => {
    expect(validerMotDePasse("a".repeat(73)).valide).toBe(false);
  });
});

describe("hachage", () => {
  it("ne garde jamais le mot de passe en clair et sait le verifier", async () => {
    const hache = await hacherMotDePasse("Soleil-Togo-2026");
    expect(hache).not.toContain("Soleil-Togo-2026");
    expect(hache.startsWith("$2")).toBe(true);
    expect(await verifierMotDePasse("Soleil-Togo-2026", hache)).toBe(true);
    expect(await verifierMotDePasse("mauvais-mot-de-passe", hache)).toBe(false);
  });
});