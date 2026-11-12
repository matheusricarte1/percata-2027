export type DfdCartPersistApi = {
  hasHydrated?: () => boolean;
};

/** O persist middleware não existe durante SSR; trate-o como não hidratado. */
export function readDfdCartHydration(persist: DfdCartPersistApi | undefined): boolean {
  return persist?.hasHydrated?.() === true;
}
