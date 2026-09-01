"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPublicMindmap = exports.MindmapRepository = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const isTestEnv = () => process.env.NODE_ENV === "test";
class MindmapStore {
    records = new Map();
    loaded = false;
    get filePath() {
        if (isTestEnv() || process.env.MINDMAP_STORE === "memory")
            return undefined;
        return process.env.DATA_FILE || node_path_1.default.join(process.cwd(), "data", "mindmaps.json");
    }
    load() {
        if (this.loaded)
            return;
        this.loaded = true;
        const file = this.filePath;
        if (!file || !node_fs_1.default.existsSync(file))
            return;
        try {
            const parsed = JSON.parse(node_fs_1.default.readFileSync(file, "utf8"));
            if (!Array.isArray(parsed))
                return;
            for (const record of parsed) {
                if (record?.id)
                    this.records.set(record.id, record);
            }
        }
        catch (error) {
            // A corrupt store must not stop the server from booting.
            console.warn(`Could not read mindmap store at ${file}:`, error);
        }
    }
    persist() {
        const file = this.filePath;
        if (!file)
            return;
        try {
            node_fs_1.default.mkdirSync(node_path_1.default.dirname(file), { recursive: true });
            node_fs_1.default.writeFileSync(file, JSON.stringify([...this.records.values()], null, 2), "utf8");
        }
        catch (error) {
            // Losing durability is not worth failing the user's request over.
            console.warn(`Could not write mindmap store at ${file}:`, error);
        }
    }
    create(mindmap, sourceText) {
        this.load();
        const record = {
            ...mindmap,
            id: (0, node_crypto_1.randomUUID)(),
            createdAt: new Date().toISOString(),
            expandedNodeIds: [],
            sourceText,
        };
        this.records.set(record.id, record);
        this.persist();
        return record;
    }
    findAll() {
        this.load();
        return [...this.records.values()]
            .map(({ id, title, createdAt }) => ({ id, title, createdAt }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    findById(id) {
        this.load();
        return this.records.get(id);
    }
    /**
     * Merge a validated drill-down layer into a stored mindmap.
     *
     * The expansion has already been checked against this graph's id set, so the
     * merge itself only has to record which node was expanded.
     */
    appendExpansion(id, nodeId, expansion) {
        this.load();
        const existing = this.records.get(id);
        if (!existing)
            return undefined;
        const updated = {
            ...existing,
            nodes: [...existing.nodes, ...expansion.nodes],
            connections: [...existing.connections, ...expansion.connections],
            expandedNodeIds: existing.expandedNodeIds.includes(nodeId)
                ? existing.expandedNodeIds
                : [...existing.expandedNodeIds, nodeId],
        };
        this.records.set(id, updated);
        this.persist();
        return updated;
    }
    /** Test hook. */
    reset() {
        this.records.clear();
        this.loaded = false;
    }
}
exports.MindmapRepository = new MindmapStore();
/** Strips internals the client has no use for. */
const toPublicMindmap = ({ sourceText: _sourceText, ...rest }) => rest;
exports.toPublicMindmap = toPublicMindmap;
