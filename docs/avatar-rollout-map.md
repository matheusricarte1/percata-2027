# Mapeamento de Avatar Categorizado (Sistema PERCATA)

## Já implantado
- `src/app/(dashboard)/dfd/[id]/page.tsx`
  - Avatar com símbolo por categoria.
  - DFD coletiva com bloco de participantes e símbolo de colaboração.
- `src/components/layout/UserNav.tsx`
  - Avatar categorizado no topo (menu + dropdown + modal de perfil).

## Próximos pontos prioritários (P1)
- `src/app/(admin)/admin/usuarios/page.tsx`
  - Lista de usuários e modal de edição já têm avatar local; migrar para `CategoryAvatar`.
- `src/app/(chefia)/triagem/page.tsx`
  - Cards e drawers de DFD mostram solicitante; aplicar `CategoryAvatar`.
- `src/app/(admin)/admin/consolidacao/page.tsx`
  - `CompactAvatar` e `AvatarGroup` locais; substituir por `CategoryAvatar`.

## Pontos secundários (P2)
- `src/app/(dashboard)/dfds-coletivas/page.tsx`
- `src/app/(dashboard)/dfds-coletivas/[id]/page.tsx`
- `src/components/dashboard/UnifiedDashboard.tsx`
- `src/app/(dashboard)/minhas-dfds/page.tsx`

## Estratégia técnica para rollout
1. Manter `CategoryAvatar` como componente canônico.
2. Resolver categoria de usuário com `roleToUserCategory`.
3. Para contexto coletivo, usar categoria `collective`.
4. Garantir fallback com iniciais quando não houver `avatar_url`.
5. Respeitar `reduced motion`/`showAnimations` para animações de avatar.

## Critérios de aceite
- Mesmo padrão visual e simbólico em lista, card, dropdown e modal.
- Contraste e tamanhos compatíveis com `globals.css` (tokens semânticos).
- Sem regressão de performance em listas grandes (usar tamanhos `sm/md`).
