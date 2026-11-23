/**
 * Motor FIFO: a partir de les operacions (trades) calcula els lots fiscals i les vendes casades amb lots.
 * És una funció pura i determinista: tax_lots i tax_disposals es regeneren sempre des d'aquí (spec §2).
 *
 * Criteris (pendents de confirmar amb l'assessor fiscal):
 * - FIFO estricte per posició, per data d'adquisició (en un traspàs, la del lot original).
 * - Accions totalment alliberades (scrip): el cost total no canvia; es reparteix entre les accions antigues
 *   i les noves, que hereten l'antiguitat dels lots dels quals provenen.
 * - Venda de drets de subscripció: abans del 2017 rebaixa el cost dels lots; des del 2017 és guany pel total.
 * - Traspàs entre fons: no és venda; els lots passen al fons de destí amb la data i el cost originals.
 */
import Big from "big.js";

Big.DP = 30;
Big.RM = Big.roundHalfUp;

export type TradeSide = "buy" | "sell" | "transfer_in" | "transfer_out" | "scrip" | "rights_sale" | "reward";

export type FifoTrade = {
  id: string;
  holdingId: string;
  date: string;
  side: TradeSide;
  quantity: string;
  amountEur: string;
  transferGroupId?: string | null;
  createdAt?: string;
};

export type FifoLot = {
  key: string;
  holdingId: string;
  buyTradeId: string;
  buyDate: string;
  quantity: string;
  remainingQty: string;
  unitCostEur: string;
  remainingCostEur: string;
};

export type FifoDisposal = {
  sellTradeId: string;
  lotKey: string;
  quantity: string;
  proceedsEur: string;
  costBasisEur: string;
  gainEur: string;
  fiscalYear: number;
};

export type FifoResult = { lots: FifoLot[]; disposals: FifoDisposal[]; errors: string[] };

const RIGHTS_ARE_GAINS_FROM = "2017-01-01";

type Lot = { key: string; holdingId: string; buyTradeId: string; buyDate: string; quantity: Big; remaining: Big; cost: Big; seq: number };

/** Ordre dins d'un mateix dia: primer el que entra, després els ajustos, els traspassos i al final les vendes. */
const SIDE_ORDER: Record<TradeSide, number> = {
  buy: 0,
  reward: 0,
  transfer_in: 0,
  scrip: 1,
  rights_sale: 2,
  transfer_out: 3,
  sell: 4,
};
const sideOrder = (t: FifoTrade) => (t.side === "transfer_in" && t.transferGroupId ? 3.5 : SIDE_ORDER[t.side]);

const money = (b: Big) => b.round(2, Big.roundHalfUp);
const qty8 = (b: Big) => b.round(8, Big.roundHalfUp);

export function computeFifo(trades: FifoTrade[]): FifoResult {
  const sorted = [...trades].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      sideOrder(a) - sideOrder(b) ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
      a.id.localeCompare(b.id),
  );

  const lots: Lot[] = [];
  const disposals: FifoDisposal[] = [];
  const errors: string[] = [];
  const moved = new Map<string, Array<{ buyTradeId: string; buyDate: string; quantity: Big; cost: Big }>>();
  let seq = 0;

  const openLots = (holdingId: string) =>
    lots
      .filter((l) => l.holdingId === holdingId && l.remaining.gt(0))
      .sort((a, b) => a.buyDate.localeCompare(b.buyDate) || a.seq - b.seq);

  /** Treu `amount` participacions dels lots oberts (FIFO). Retorna els trossos consumits amb el seu cost. */
  const consume = (t: FifoTrade, amount: Big) => {
    const pieces: Array<{ lot: Lot; quantity: Big; cost: Big }> = [];
    let left = amount;
    for (const lot of openLots(t.holdingId)) {
      if (left.lte(0)) break;
      const q = left.lt(lot.remaining) ? left : lot.remaining;
      // L'últim tros d'un lot s'emporta el cost que li queda exactament (sense residus d'arrodoniment).
      const cost = q.eq(lot.remaining) ? lot.cost : money(lot.cost.times(q).div(lot.remaining));
      lot.remaining = lot.remaining.minus(q);
      lot.cost = lot.cost.minus(cost);
      pieces.push({ lot, quantity: q, cost });
      left = left.minus(q);
    }
    if (left.gt(0)) {
      errors.push(`${t.date}: ${t.side === "sell" ? "venda" : "traspàs"} de ${amount.toFixed()} sense prou participacions (en falten ${left.toFixed()}).`);
    }
    return pieces;
  };

  const newLot = (t: FifoTrade, quantity: Big, cost: Big, extra?: Partial<Lot>) => {
    const lot: Lot = {
      key: extra?.key ?? t.id,
      holdingId: t.holdingId,
      buyTradeId: extra?.buyTradeId ?? t.id,
      buyDate: extra?.buyDate ?? t.date,
      quantity,
      remaining: quantity,
      cost,
      seq: seq++,
    };
    lots.push(lot);
    return lot;
  };

  for (const t of sorted) {
    const quantity = new Big(t.quantity);
    const amount = new Big(t.amountEur);

    switch (t.side) {
      case "buy":
      case "reward":
        newLot(t, quantity, amount);
        break;

      case "transfer_in": {
        if (!t.transferGroupId) {
          // Entrada sense origen a l'app (saldo d'obertura o lot fiscal importat): és un lot amb la seva data.
          newLot(t, quantity, amount);
          break;
        }
        const pieces = moved.get(t.transferGroupId);
        if (!pieces?.length) {
          errors.push(`${t.date}: entrada de traspàs sense la sortida corresponent.`);
          newLot(t, quantity, amount);
          break;
        }
        const outTotal = pieces.reduce((acc, p) => acc.plus(p.quantity), new Big(0));
        let assigned = new Big(0);
        pieces.forEach((p, i) => {
          const q = i === pieces.length - 1 ? quantity.minus(assigned) : qty8(quantity.times(p.quantity).div(outTotal));
          assigned = assigned.plus(q);
          newLot(t, q, p.cost, { key: `${t.id}:${i}`, buyTradeId: p.buyTradeId, buyDate: p.buyDate });
        });
        moved.delete(t.transferGroupId);
        break;
      }

      case "transfer_out": {
        const pieces = consume(t, quantity);
        if (!t.transferGroupId) {
          errors.push(`${t.date}: sortida de traspàs sense grup: es tracta com una baixa sense guany.`);
          break;
        }
        moved.set(
          t.transferGroupId,
          pieces.map((p) => ({ buyTradeId: p.lot.buyTradeId, buyDate: p.lot.buyDate, quantity: p.quantity, cost: p.cost })),
        );
        break;
      }

      case "sell": {
        const pieces = consume(t, quantity);
        let proceedsLeft = amount;
        pieces.forEach((p, i) => {
          const proceeds = i === pieces.length - 1 ? proceedsLeft : money(amount.times(p.quantity).div(quantity));
          proceedsLeft = proceedsLeft.minus(proceeds);
          disposals.push({
            sellTradeId: t.id,
            lotKey: p.lot.key,
            quantity: qty8(p.quantity).toFixed(8),
            proceedsEur: proceeds.toFixed(2),
            costBasisEur: money(p.cost).toFixed(2),
            gainEur: money(proceeds.minus(p.cost)).toFixed(2),
            fiscalYear: Number(t.date.slice(0, 4)),
          });
        });
        break;
      }

      case "scrip": {
        const open = openLots(t.holdingId);
        const held = open.reduce((acc, l) => acc.plus(l.remaining), new Big(0));
        if (held.eq(0)) {
          errors.push(`${t.date}: accions alliberades sense accions prèvies: s'afegeixen com a lot de cost zero.`);
          newLot(t, quantity, new Big(0));
          break;
        }
        // Les noves accions es reparteixen entre els lots oberts en proporció; el cost total no canvia.
        let assigned = new Big(0);
        open.forEach((lot, i) => {
          const extra = i === open.length - 1 ? quantity.minus(assigned) : qty8(quantity.times(lot.remaining).div(held));
          assigned = assigned.plus(extra);
          lot.remaining = lot.remaining.plus(extra);
          lot.quantity = lot.quantity.plus(extra);
        });
        break;
      }

      case "rights_sale": {
        if (t.date < RIGHTS_ARE_GAINS_FROM) {
          // Abans del 2017: l'import rebaixa el cost dels lots oberts, en proporció a les participacions.
          const open = openLots(t.holdingId);
          const held = open.reduce((acc, l) => acc.plus(l.remaining), new Big(0));
          if (held.eq(0)) {
            errors.push(`${t.date}: venda de drets sense accions prèvies.`);
            break;
          }
          let left = amount;
          open.forEach((lot, i) => {
            const reduction = i === open.length - 1 ? left : money(amount.times(lot.remaining).div(held));
            left = left.minus(reduction);
            lot.cost = lot.cost.minus(reduction);
            if (lot.cost.lt(0)) {
              errors.push(`${t.date}: la venda de drets supera el cost d'un lot; el lot queda a cost zero.`);
              lot.cost = new Big(0);
            }
          });
        } else {
          // Des del 2017: guany patrimonial pel total. Lot sintètic de cost zero que es ven sencer.
          const lot = newLot(t, quantity, new Big(0), { key: `${t.id}:drets` });
          lot.remaining = new Big(0);
          disposals.push({
            sellTradeId: t.id,
            lotKey: lot.key,
            quantity: qty8(quantity).toFixed(8),
            proceedsEur: money(amount).toFixed(2),
            costBasisEur: "0.00",
            gainEur: money(amount).toFixed(2),
            fiscalYear: Number(t.date.slice(0, 4)),
          });
        }
        break;
      }
    }
  }

  for (const [group] of moved) errors.push(`Traspàs ${group}: sortida sense l'entrada corresponent.`);

  return {
    lots: lots.map((l) => ({
      key: l.key,
      holdingId: l.holdingId,
      buyTradeId: l.buyTradeId,
      buyDate: l.buyDate,
      quantity: qty8(l.quantity).toFixed(8),
      remainingQty: qty8(l.remaining).toFixed(8),
      unitCostEur: l.remaining.gt(0) ? qty8(l.cost.div(l.remaining)).toFixed(8) : "0.00000000",
      remainingCostEur: money(l.cost).toFixed(2),
    })),
    disposals,
    errors,
  };
}

/** Resum per posició: participacions, cost FIFO de les que queden i guany realitzat per any. */
export function summarizeFifo(result: FifoResult) {
  const byHolding = new Map<string, { quantity: Big; cost: Big }>();
  for (const lot of result.lots) {
    const s = byHolding.get(lot.holdingId) ?? { quantity: new Big(0), cost: new Big(0) };
    s.quantity = s.quantity.plus(lot.remainingQty);
    s.cost = s.cost.plus(lot.remainingCostEur);
    byHolding.set(lot.holdingId, s);
  }
  const gainsByYear = new Map<number, Big>();
  for (const d of result.disposals) gainsByYear.set(d.fiscalYear, (gainsByYear.get(d.fiscalYear) ?? new Big(0)).plus(d.gainEur));
  return {
    positions: new Map([...byHolding].map(([k, v]) => [k, { quantity: v.quantity.toFixed(8), cost: v.cost.toFixed(2) }])),
    gainsByYear: new Map([...gainsByYear].map(([k, v]) => [k, v.toFixed(2)])),
  };
}
