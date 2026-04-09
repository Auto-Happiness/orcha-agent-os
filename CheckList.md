Address

encryptedUri isn't actually encrypted — it's plain JSON. The name is misleading and the connection credentials (host, user, password) are stored in plaintext in Convex. Before going to prod, run them through KeyManager.encrypt the same way AI keys are handled.

chatMessages.parts is v.any() — no size validation before insert. A malicious or buggy response could still write a large document. Worth adding a byte-size check before the Convex insert.

The listByOrganizationAndUser query in chatSessions.ts calls checkMembership which does 3 DB reads (identity → user → membership lookup). For users with many sessions this runs on every Convex subscription tick. Could be optimized by caching the user lookup or using a lighter auth check.