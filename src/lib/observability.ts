/**
 * Observabilidade — wrapper sobre Sentry que NÃO requer a dep instalada.
 *
 * Estratégia:
 *   - Em runtime, tentamos `await import("@sentry/nextjs")` dinamicamente.
 *   - Se a dep não está instalada (ainda), cai silenciosamente para console.
 *   - Se está, usa Sentry com a DSN de `SENTRY_DSN` (ou NEXT_PUBLIC_SENTRY_DSN).
 *
 * Isso evita o erro clássico: time não quer ainda instalar Sentry, mas
 * já queremos chamadas a `captureError()` espalhadas no código.
 *
 * Para ativar Sentry de fato:
 *   1. npm install --save @sentry/nextjs
 *   2. Defina SENTRY_DSN no .env (Vercel/Supabase).
 *   3. Crie sentry.client.config.ts e sentry.server.config.ts (templates
 *      do Sentry; podem ser gerados com `npx @sentry/wizard@latest -i nextjs`).
 *   4. Em next.config.ts, opcionalmente envolva com `withSentryConfig`.
 *
 * Sem a dep instalada, todas as chamadas viram console.* — zero overhead.
 */

type SentryModule = {
  captureException: (err: unknown, ctx?: unknown) => void;
  captureMessage: (msg: string, level?: string) => void;
  addBreadcrumb: (b: unknown) => void;
};

let sentryPromise: Promise<SentryModule | null> | null = null;

function getSentry(): Promise<SentryModule | null> {
  if (!sentryPromise) {
    sentryPromise = (async () => {
      try {
        // Import dinâmico via string variable: o TypeScript não tenta
        // resolver a tipagem do módulo (já que o specifier não é literal),
        // e o webpack/Next gera um chunk opcional. Se a dep não estiver
        // instalada em runtime, o import rejeita e caímos no catch.
        const specifier = "@sentry/nextjs";
        const mod = await (Function(
          "s",
          "return import(s)",
        )(specifier) as Promise<unknown>).catch(() => null);
        if (!mod) return null;
        return mod as SentryModule;
      } catch {
        return null;
      }
    })();
  }
  return sentryPromise;
}

export async function captureError(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const sentry = await getSentry();
  if (sentry) {
    sentry.captureException(err, context ? { extra: context } : undefined);
    return;
  }
  console.error("[error]", err, context || "");
}

export async function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
): Promise<void> {
  const sentry = await getSentry();
  if (sentry) {
    sentry.captureMessage(message, level);
    return;
  }
  const logger =
    level === "error"
      ? console.error
      : level === "warning"
      ? console.warn
      : console.info;
  logger(`[${level}] ${message}`);
}

export async function addBreadcrumb(b: {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  level?: "info" | "warning" | "error";
}): Promise<void> {
  const sentry = await getSentry();
  if (sentry) sentry.addBreadcrumb(b);
  // Sem Sentry, breadcrumbs são descartados (são contextuais; logar todos
  // poluiria o console).
}
