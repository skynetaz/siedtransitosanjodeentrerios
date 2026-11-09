<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Plan feature flags live in public.instituciones.features (row es_principal = this install); platform owner = public.platform_owners. Why: lets the provider sell plans without code changes.
- Multi-tenant: each municipality owns its questions, categories, exams and codes via institucion_id; staff are tied through institucion_miembros and current_institucion(). Server code using the admin client must filter/set institucion_id explicitly. Why: admin client bypasses the RLS isolation.
