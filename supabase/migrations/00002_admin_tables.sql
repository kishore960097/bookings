-- 1. Create Enums
DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE feature_request_status AS ENUM ('submitted', 'under_review', 'approved', 'in_development', 'implemented', 'declined'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE feature_request_urgency AS ENUM ('low', 'medium', 'high'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    attachment_url TEXT,
    priority ticket_priority DEFAULT 'medium',
    status ticket_status DEFAULT 'open',
    internal_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Feature Requests Table
CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    urgency feature_request_urgency DEFAULT 'medium',
    votes_count INTEGER DEFAULT 0,
    status feature_request_status DEFAULT 'submitted',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Feature Request Votes Table
CREATE TABLE IF NOT EXISTS feature_request_votes (
    request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (request_id, user_id)
);

-- 5. Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_request_votes ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Admin: Full Access | User: Create & Read Own)
-- Support Tickets
CREATE POLICY "Admins have full access to support_tickets" ON support_tickets FOR ALL USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' ) WITH CHECK ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
CREATE POLICY "Users can create support_tickets" ON support_tickets FOR INSERT WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Users can read own support_tickets" ON support_tickets FOR SELECT USING ( auth.uid() = user_id );

-- Feature Requests
CREATE POLICY "Admins have full access to feature_requests" ON feature_requests FOR ALL USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' ) WITH CHECK ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
CREATE POLICY "Users can create feature_requests" ON feature_requests FOR INSERT WITH CHECK ( auth.uid() = requester_id );
CREATE POLICY "Users can read own feature_requests" ON feature_requests FOR SELECT USING ( auth.uid() = requester_id );

-- Feature Request Votes
CREATE POLICY "Admins have full access to feature_request_votes" ON feature_request_votes FOR ALL USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' ) WITH CHECK ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );
CREATE POLICY "Users can create votes" ON feature_request_votes FOR INSERT WITH CHECK ( auth.uid() = user_id );
CREATE POLICY "Users can delete own votes" ON feature_request_votes FOR DELETE USING ( auth.uid() = user_id );
CREATE POLICY "Everyone can read votes" ON feature_request_votes FOR SELECT USING ( true );

-- 7. Keep timestamps and denormalized vote counts accurate.
CREATE OR REPLACE FUNCTION set_admin_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION sync_feature_request_votes() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN UPDATE feature_requests SET votes_count = (SELECT COUNT(*) FROM feature_request_votes WHERE request_id = COALESCE(NEW.request_id, OLD.request_id)), updated_at = NOW() WHERE id = COALESCE(NEW.request_id, OLD.request_id); RETURN COALESCE(NEW, OLD); END; $$;
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION set_admin_updated_at();
CREATE TRIGGER feature_requests_updated_at BEFORE UPDATE ON feature_requests FOR EACH ROW EXECUTE FUNCTION set_admin_updated_at();
CREATE TRIGGER feature_request_votes_sync AFTER INSERT OR DELETE ON feature_request_votes FOR EACH ROW EXECUTE FUNCTION sync_feature_request_votes();

-- Seed the initial administrator after the account exists:
-- UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'cjkishore35@gmail.com');
