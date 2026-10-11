CREATE TABLE community_guides (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 author_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), moderation_reason TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 1, published_revision INTEGER NOT NULL DEFAULT 0,
 draft_json TEXT NOT NULL CHECK(length(CAST(draft_json AS BLOB))<=150000), published_json TEXT CHECK(published_json IS NULL OR length(CAST(published_json AS BLOB))<=150000),
 title TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', topic TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT
);
CREATE INDEX community_catalogue ON community_guides(status,hidden,published_at DESC,id);
CREATE INDEX community_owner ON community_guides(owner_id,updated_at DESC);
CREATE TRIGGER community_guide_capacity BEFORE INSERT ON community_guides
WHEN (SELECT COUNT(*) FROM community_guides WHERE owner_id=NEW.owner_id)>=50 OR (SELECT COUNT(*) FROM community_guides)>=10000
BEGIN SELECT RAISE(ABORT,'Community guide quota reached'); END;
CREATE TABLE community_assets (
 id TEXT PRIMARY KEY, guide_id TEXT NOT NULL REFERENCES community_guides(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, bytes INTEGER NOT NULL CHECK(bytes>0 AND bytes<=5000000),
 mime TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('pending','ready','delete')), created_at TEXT NOT NULL
);
CREATE INDEX community_asset_owner ON community_assets(owner_id);
CREATE INDEX community_asset_guide ON community_assets(guide_id,state);
CREATE TRIGGER community_asset_capacity BEFORE INSERT ON community_assets
WHEN COALESCE((SELECT SUM(bytes) FROM community_assets WHERE owner_id=NEW.owner_id),0)+NEW.bytes>100000000
 OR COALESCE((SELECT SUM(bytes) FROM community_assets WHERE guide_id=NEW.guide_id),0)+NEW.bytes>25000000
 OR COALESCE((SELECT SUM(bytes) FROM community_assets),0)+NEW.bytes>2000000000
 OR (SELECT COUNT(*) FROM community_assets WHERE guide_id=NEW.guide_id)>=50
BEGIN SELECT RAISE(ABORT,'Community image quota reached'); END;
CREATE TABLE community_progress (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, guide_id TEXT NOT NULL REFERENCES community_guides(id) ON DELETE CASCADE,
 step_id TEXT NOT NULL, completed INTEGER NOT NULL CHECK(completed IN (0,1)), updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,guide_id,step_id)
);
CREATE TABLE community_history (
 id TEXT PRIMARY KEY, guide_id TEXT NOT NULL REFERENCES community_guides(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, content_json TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX community_history_guide ON community_history(guide_id,revision DESC);
CREATE TABLE community_audit (
 id TEXT PRIMARY KEY, guide_id TEXT NOT NULL REFERENCES community_guides(id) ON DELETE CASCADE,
 actor_id TEXT, actor_name TEXT NOT NULL, action TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX community_audit_guide ON community_audit(guide_id,created_at DESC);

-- Sweep bounded batches rather than scanning every referenced image each minute.
CREATE INDEX community_asset_cleanup ON community_assets(created_at,id);
CREATE INDEX community_asset_retry ON community_assets(state,created_at);
CREATE TABLE community_gc (id INTEGER PRIMARY KEY CHECK(id=1), cursor_date TEXT NOT NULL DEFAULT '', cursor_id TEXT NOT NULL DEFAULT '');
INSERT INTO community_gc(id) VALUES(1);
