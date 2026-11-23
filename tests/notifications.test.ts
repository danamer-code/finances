import { describe, expect, test } from "vitest";

import { planNotices, type NoticeState } from "@/lib/notifications";

const base: NoticeState = { today: "2026-11-23", newPending: [], budgets: [], staleBalances: 0, alreadySent: new Set() };

describe("avisos del dia", () => {
  test("sense res pendent no s'envia res", () => {
    expect(planNotices(base)).toEqual([]);
  });

  test("els pendents nous s'agrupen en un sol avís", () => {
    const [n] = planNotices({ ...base, newPending: ["Interessos Banc A", "Interessos Banc B"] });
    expect(n.key).toBe("pendents:2026-11-23");
    expect(n.title).toBe("Falta l'import");
    expect(n.body).toBe("Interessos Banc A i Interessos Banc B: escriu la xifra quan la tinguis.");
  });

  test("pressupost: avís al 80 % i al 100 %, un sol cop cadascun", () => {
    const at85 = planNotices({ ...base, budgets: [{ id: "oci", name: "Oci", spent: "170", budget: "200" }] });
    expect(at85.map((n) => n.key)).toEqual(["pressupost:oci:2026-11:80"]);
    expect(at85[0].title).toBe("Oci: ja portes el 85 %");
    expect(at85[0].body).toBe("170,00 € de 200,00 € aquest mes.");
    expect(at85[0].url).toBe("/moviments?mes=2026-11&categoria=oci");

    const repeat = planNotices({ ...base, budgets: [{ id: "oci", name: "Oci", spent: "180", budget: "200" }], alreadySent: new Set(["pressupost:oci:2026-11:80"]) });
    expect(repeat).toEqual([]);

    const over = planNotices({ ...base, budgets: [{ id: "oci", name: "Oci", spent: "230", budget: "200" }], alreadySent: new Set(["pressupost:oci:2026-11:80"]) });
    expect(over.map((n) => n.title)).toEqual(["Has superat el pressupost de Oci"]);
  });

  test("saldos un cop al mes i el Wrapped el desembre i el gener", () => {
    expect(planNotices({ ...base, staleBalances: 2 }).map((n) => n.body)).toEqual(["2 comptes encara no tenen el saldo de novembre."]);
    expect(planNotices({ ...base, staleBalances: 2, alreadySent: new Set(["saldos:2026-11"]) })).toEqual([]);
    expect(planNotices({ ...base, today: "2026-12-01" }).map((n) => n.key)).toEqual(["wrapped:2026"]);
    expect(planNotices({ ...base, today: "2027-01-01" }).map((n) => n.key)).toEqual(["wrapped-final:2026"]);
  });
});

describe("avisos en l'idioma i la divisa de l'usuari", () => {
  test("anglès i dòlars", () => {
    const prefs = { locale: "en", currency: "USD" } as const;
    const [budget] = planNotices({ ...base, budgets: [{ id: "oci", name: "Leisure", spent: "170", budget: "200" }] }, prefs);
    expect(budget.key).toBe("pressupost:oci:2026-11:80");
    expect(budget.title).toBe("Leisure: you're already at 85%");
    expect(budget.body).toBe("$170.00 of $200.00 this month.");
    expect(planNotices({ ...base, newPending: ["A", "B", "C"] }, prefs)[0].body).toBe("A, B and C: add the figure when you have it.");
    expect(planNotices({ ...base, staleBalances: 1 }, prefs)[0].body).toBe("1 account doesn't have its November balance yet.");
    expect(planNotices({ ...base, today: "2026-12-01" }, prefs)[0].title).toBe("Your 2026 is here");
  });

  test("hebreu i xéquels", () => {
    const prefs = { locale: "he", currency: "ILS" } as const;
    const [budget] = planNotices({ ...base, budgets: [{ id: "oci", name: "בילויים", spent: "230", budget: "200" }] }, prefs);
    expect(budget.title).toBe("חרגת מהתקציב של בילויים");
    expect(budget.body).toBe("230.00 ₪ מתוך 200.00 ₪ החודש.");
    // «ו» s'enganxa a una paraula hebrea; davant d'una de llatina va amb guionet.
    expect(planNotices({ ...base, newPending: ["שכירות", "חשמל"] }, prefs)[0].body.startsWith("שכירות וחשמל:")).toBe(true);
    expect(planNotices({ ...base, newPending: ["שכירות", "Netflix"] }, prefs)[0].body.startsWith("שכירות ו-Netflix:")).toBe(true);
    expect(planNotices({ ...base, today: "2027-01-01" }, prefs)[0].title).toBe("ה-2026 שלך, במלואו");
  });
});
