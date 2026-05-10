
-- =================================================================================
-- CORREÇÃO DEFINITIVA DE RLS PARA ADMINISTRAÇÃO DA COMUNIDADE
-- =================================================================================

-- 1. Limpar políticas existentes de exclusão
DROP POLICY IF EXISTS "community_posts_delete" ON public.community_posts;
DROP POLICY IF EXISTS "community_comments_delete" ON public.community_comments;
DROP POLICY IF EXISTS "community_messages_delete" ON public.community_messages;

-- 2. Nova Política de Exclusão de Posts (Autor ou Gestão)
CREATE POLICY "community_posts_delete" ON public.community_posts FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.usuarios u
        LEFT JOIN public.avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' OR 
            COALESCE(u.is_super_admin, FALSE) = TRUE OR 
            LOWER(u.role) = 'gestor' OR
            LOWER(a.funcao) IN ('gestor', 'coordenador', 'admin')
        )
    )
);

-- 3. Nova Política de Exclusão de Comentários
CREATE POLICY "community_comments_delete" ON public.community_comments FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.usuarios u
        LEFT JOIN public.avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' OR 
            COALESCE(u.is_super_admin, FALSE) = TRUE OR 
            LOWER(a.funcao) IN ('gestor', 'coordenador', 'admin')
        )
    )
);

-- 4. Nova Política de Exclusão de Mensagens
CREATE POLICY "community_messages_delete" ON public.community_messages FOR DELETE USING (
    auth.uid() = sender_id OR 
    EXISTS (
        SELECT 1 FROM public.usuarios u
        LEFT JOIN public.avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' OR 
            COALESCE(u.is_super_admin, FALSE) = TRUE OR 
            LOWER(a.funcao) IN ('gestor', 'coordenador', 'admin')
        )
    )
);

NOTIFY pgrst, 'reload schema';
