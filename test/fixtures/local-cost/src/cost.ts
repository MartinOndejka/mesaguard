import { AccountUpdate } from "o1js";

export namespace TransactionCost {
  export const PROOF_COST = 10.26;
}

export function localEstimate(_updates: AccountUpdate[]) {
  return TransactionCost.PROOF_COST;
}
