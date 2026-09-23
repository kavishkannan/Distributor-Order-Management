import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/data-source";

export type TransactionContext = EntityManager;

export function runInTransaction<T>(
  Work: (Tx: TransactionContext) => Promise<T>,
): Promise<T> {
  return AppDataSource.manager.transaction(Work);
}

export function managerFor(Tx?: TransactionContext): EntityManager {
  return Tx ?? AppDataSource.manager;
}

export function isUniqueViolation(Err: unknown): boolean {
  return (
    typeof Err === "object" &&
    Err !== null &&
    (Err as { code?: string }).code === "ER_DUP_ENTRY"
  );
}
