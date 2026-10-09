-- SQLite. Un estado validado y versionado para la demostración de un operador.
CREATE TABLE IF NOT EXISTS application_state (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 revision INTEGER NOT NULL,
 payload TEXT NOT NULL
);
-- Las actualizaciones usan WHERE revision = ? para evitar sobrescribir otra ventana.
