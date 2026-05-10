-- =================================================================================
-- CONSOLIDATED DATABASE FIX FOR COMMUNITY
-- =================================================================================

-- 1. Ensure the 'read' column exists in community_messages
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='community_messages' AND column_name='read') THEN
        ALTER TABLE public.community_messages ADD COLUMN "read" BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. CREATE TRIGGERS FOR LIKES AND COMMENTS COUNTERS (SECURITY DEFINER)
-- Using SECURITY DEFINER allows the count to be updated even if the user can't update the post directly

CREATE OR REPLACE FUNCTION update_post_counters() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'community_likes') THEN
            UPDATE community_posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'community_comments') THEN
            UPDATE community_posts SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'community_likes') THEN
            UPDATE community_posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'community_comments') THEN
            UPDATE community_posts SET comments_count = GREATEST(0, COALESCE(comments_count, 0) - 1) WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS tr_update_likes_count ON community_likes;
DROP TRIGGER IF EXISTS tr_update_comments_count ON community_comments;

CREATE TRIGGER tr_update_likes_count
AFTER INSERT OR DELETE ON community_likes
FOR EACH ROW EXECUTE FUNCTION update_post_counters();

CREATE TRIGGER tr_update_comments_count
AFTER INSERT OR DELETE ON community_comments
FOR EACH ROW EXECUTE FUNCTION update_post_counters();

-- 3. HARDENED RLS POLICIES

-- Disable RLS and Enable again to clear everything if needed, but safer to drop policies
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

-- Drop all possible policies to start clean
DROP POLICY IF EXISTS "community_posts_select" ON community_posts;
DROP POLICY IF EXISTS "community_posts_insert" ON community_posts;
DROP POLICY IF EXISTS "community_posts_update" ON community_posts;
DROP POLICY IF EXISTS "community_posts_delete" ON community_posts;

DROP POLICY IF EXISTS "community_comments_select" ON community_comments;
DROP POLICY IF EXISTS "community_comments_insert" ON community_comments;
DROP POLICY IF EXISTS "community_comments_delete" ON community_comments;

DROP POLICY IF EXISTS "community_likes_select" ON community_likes;
DROP POLICY IF EXISTS "community_likes_insert" ON community_likes;
DROP POLICY IF EXISTS "community_likes_delete" ON community_likes;

DROP POLICY IF EXISTS "community_messages_select" ON community_messages;
DROP POLICY IF EXISTS "community_messages_insert" ON community_messages;
DROP POLICY IF EXISTS "community_messages_update" ON community_messages;
DROP POLICY IF EXISTS "community_messages_delete" ON community_messages;

-- RE-CREATE POLICIES (POSTS)
CREATE POLICY "community_posts_select" ON community_posts FOR SELECT USING (
    organizacao_id IN (SELECT organizacao_id FROM usuarios WHERE id = auth.uid()) OR 
    EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND COALESCE(is_super_admin, FALSE) = TRUE)
);
CREATE POLICY "community_posts_insert" ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_posts_update" ON community_posts FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        LEFT JOIN avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' 
            OR COALESCE(u.is_super_admin, FALSE) = TRUE
            OR (LOWER(u.role) = 'avaliador' AND LOWER(a.funcao) IN ('gestor', 'coordenador'))
        )
    )
);
CREATE POLICY "community_posts_delete" ON community_posts FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        LEFT JOIN avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' 
            OR COALESCE(u.is_super_admin, FALSE) = TRUE
            OR (LOWER(u.role) = 'avaliador' AND LOWER(a.funcao) IN ('gestor', 'coordenador'))
        )
    )
);

-- RE-CREATE POLICIES (COMMENTS)
CREATE POLICY "community_comments_select" ON community_comments FOR SELECT USING (TRUE);
CREATE POLICY "community_comments_insert" ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_comments_delete" ON community_comments FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        LEFT JOIN avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' 
            OR COALESCE(u.is_super_admin, FALSE) = TRUE
            OR (LOWER(u.role) = 'avaliador' AND LOWER(a.funcao) IN ('gestor', 'coordenador'))
        )
    )
);

-- RE-CREATE POLICIES (LIKES)
CREATE POLICY "community_likes_select" ON community_likes FOR SELECT USING (TRUE);
CREATE POLICY "community_likes_insert" ON community_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_likes_delete" ON community_likes FOR DELETE USING (auth.uid() = user_id);

-- RE-CREATE POLICIES (MESSAGES)
CREATE POLICY "community_messages_select" ON community_messages FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        LEFT JOIN avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' 
            OR COALESCE(u.is_super_admin, FALSE) = TRUE
            OR (LOWER(u.role) = 'avaliador' AND LOWER(a.funcao) IN ('gestor', 'coordenador'))
        )
    )
);
CREATE POLICY "community_messages_insert" ON community_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "community_messages_update" ON community_messages FOR UPDATE USING (
    auth.uid() = receiver_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        LEFT JOIN avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' 
            OR COALESCE(u.is_super_admin, FALSE) = TRUE
            OR (LOWER(u.role) = 'avaliador' AND LOWER(a.funcao) IN ('gestor', 'coordenador'))
        )
    )
);
CREATE POLICY "community_messages_delete" ON community_messages FOR DELETE USING (
    auth.uid() = sender_id OR 
    EXISTS (
        SELECT 1 FROM usuarios u 
        LEFT JOIN avaliadores a ON u.reference_id = a.id
        WHERE u.id = auth.uid() 
        AND (
            LOWER(u.role) = 'admin' 
            OR COALESCE(u.is_super_admin, FALSE) = TRUE
            OR (LOWER(u.role) = 'avaliador' AND LOWER(a.funcao) IN ('gestor', 'coordenador'))
        )
    )
);

-- Realtime Setup
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE community_posts;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE community_comments;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE community_likes;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE community_messages;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
