import { Client } from "mina-signer";
import { TransactionCost, VerificationKey } from "o1js";

declare const transaction: { setFeePerSnarkCost(value: number): void };
declare const verificationKey: VerificationKey;

transaction.setFeePerSnarkCost(TransactionCost.PROOF_COST);
const encoded: string = verificationKey.toJSON();
const signer = new Client({ network: "mainnet" });

export { encoded, signer };
