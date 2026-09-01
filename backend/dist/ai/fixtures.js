"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIXTURES = void 0;
exports.matchFixture = matchFixture;
exports.syntheticMindmap = syntheticMindmap;
exports.syntheticExpansion = syntheticExpansion;
exports.FIXTURES = [
    {
        key: "photosynthesis",
        keywords: ["photosynthesis", "chlorophyll", "glucose", "sunlight", "plants"],
        mindmap: {
            title: "How Photosynthesis Works",
            rootId: "n1",
            nodes: [
                {
                    id: "n1",
                    label: "Photosynthesis",
                    summary: "Photosynthesis is the process by which plants convert light energy into chemical energy stored as sugar.",
                },
                {
                    id: "n2",
                    label: "Light Energy",
                    summary: "Sunlight supplies the energy that drives the entire photosynthetic reaction.",
                },
                {
                    id: "n3",
                    label: "Chlorophyll",
                    summary: "Chlorophyll is the green pigment in leaves that absorbs light and passes its energy into the reaction.",
                },
                {
                    id: "n4",
                    label: "Water And CO2",
                    summary: "Water drawn up by the roots and carbon dioxide taken in through the leaves are the raw inputs.",
                },
                {
                    id: "n5",
                    label: "Glucose",
                    summary: "Glucose is the sugar produced by the reaction, storing chemical energy the plant can spend later.",
                },
                {
                    id: "n6",
                    label: "Oxygen",
                    summary: "Oxygen is released as a by-product and is what makes the atmosphere breathable for aerobic life.",
                },
            ],
            connections: [
                { from: "n1", to: "n2", label: "harnesses" },
                { from: "n2", to: "n3", label: "captured by" },
                { from: "n1", to: "n4", label: "consumes" },
                { from: "n1", to: "n5", label: "produces" },
                { from: "n1", to: "n6", label: "releases" },
            ],
        },
        expansions: {
            n5: {
                nodes: [
                    {
                        id: "n5x1",
                        label: "Starch Storage",
                        summary: "Surplus glucose is polymerised into starch and stored in roots, tubers and seeds for later use.",
                    },
                    {
                        id: "n5x2",
                        label: "Cellular Respiration",
                        summary: "Glucose is broken back down in the mitochondria to release usable energy on demand.",
                    },
                    {
                        id: "n5x3",
                        label: "Cellulose Walls",
                        summary: "Glucose units are chained into cellulose, the structural fibre that gives plant cells their rigidity.",
                    },
                ],
                connections: [
                    { from: "n5", to: "n5x1", label: "stored as" },
                    { from: "n5", to: "n5x2", label: "fuels" },
                    { from: "n5", to: "n5x3", label: "builds" },
                ],
            },
            n3: {
                nodes: [
                    {
                        id: "n3x1",
                        label: "Chlorophyll A",
                        summary: "The primary pigment that sits at the reaction centre and donates excited electrons.",
                    },
                    {
                        id: "n3x2",
                        label: "Accessory Pigments",
                        summary: "Carotenoids and chlorophyll b widen the range of wavelengths the leaf can harvest.",
                    },
                    {
                        id: "n3x3",
                        label: "Thylakoid Membrane",
                        summary: "The stacked membrane inside the chloroplast where the light-dependent reactions take place.",
                    },
                ],
                connections: [
                    { from: "n3", to: "n3x1", label: "type of" },
                    { from: "n3", to: "n3x2", label: "assisted by" },
                    { from: "n3", to: "n3x3", label: "embedded in" },
                ],
            },
        },
    },
    {
        key: "sprint",
        keywords: ["standup", "sprint", "retro", "meeting notes", "action item", "blocker"],
        mindmap: {
            title: "Sprint Planning Notes",
            rootId: "m1",
            nodes: [
                {
                    id: "m1",
                    label: "Sprint Planning",
                    summary: "The team met to scope the next two-week sprint and agree on what ships.",
                },
                {
                    id: "m2",
                    label: "Checkout Rewrite",
                    summary: "Rewriting the checkout flow was accepted as the headline deliverable for the sprint.",
                },
                {
                    id: "m3",
                    label: "Payment Blocker",
                    summary: "The payment provider sandbox is returning stale tokens, which blocks end-to-end testing.",
                },
                {
                    id: "m4",
                    label: "Design Handoff",
                    summary: "Final mobile mockups are due from design on Wednesday before engineering can finish the UI.",
                },
                {
                    id: "m5",
                    label: "Action Items",
                    summary: "Each blocker was assigned an owner with a deadline before the end of the week.",
                },
                {
                    id: "m6",
                    label: "Release Date",
                    summary: "The team committed to a release candidate by the last Friday of the sprint.",
                },
            ],
            connections: [
                { from: "m1", to: "m2", label: "commits to" },
                { from: "m2", to: "m3", label: "blocked by" },
                { from: "m2", to: "m4", label: "depends on" },
                { from: "m1", to: "m5", label: "produced" },
                { from: "m5", to: "m6", label: "targets" },
            ],
        },
        expansions: {
            m3: {
                nodes: [
                    {
                        id: "m3x1",
                        label: "Stale Tokens",
                        summary: "Sandbox tokens expire after ten minutes but are cached for an hour by the client.",
                    },
                    {
                        id: "m3x2",
                        label: "Vendor Ticket",
                        summary: "A support ticket is open with the payment provider and awaiting a first response.",
                    },
                ],
                connections: [
                    { from: "m3", to: "m3x1", label: "caused by" },
                    { from: "m3", to: "m3x2", label: "tracked in" },
                ],
            },
        },
    },
    {
        key: "remote-work",
        keywords: ["remote work", "hybrid", "office", "commute", "distributed team"],
        mindmap: {
            title: "The Shift To Remote Work",
            rootId: "r1",
            nodes: [
                {
                    id: "r1",
                    label: "Remote Work",
                    summary: "Remote work moved from a rare perk to a default operating mode for large parts of the economy.",
                },
                {
                    id: "r2",
                    label: "Async Communication",
                    summary: "Distributed teams lean on written, asynchronous updates instead of synchronous meetings.",
                },
                {
                    id: "r3",
                    label: "Talent Pool",
                    summary: "Hiring without a commute radius widens the pool of candidates a company can reach.",
                },
                {
                    id: "r4",
                    label: "Office Costs",
                    summary: "Reduced desk footprints cut one of the largest fixed line items on the balance sheet.",
                },
                {
                    id: "r5",
                    label: "Onboarding Friction",
                    summary: "New joiners lose the incidental learning that came from sitting beside experienced colleagues.",
                },
                {
                    id: "r6",
                    label: "Hybrid Compromise",
                    summary: "Most organisations settled on a hybrid split rather than choosing either extreme.",
                },
            ],
            connections: [
                { from: "r1", to: "r2", label: "requires" },
                { from: "r1", to: "r3", label: "widens" },
                { from: "r1", to: "r4", label: "reduces" },
                { from: "r1", to: "r5", label: "worsens" },
                { from: "r5", to: "r6", label: "motivates" },
            ],
        },
        expansions: {
            r2: {
                nodes: [
                    {
                        id: "r2x1",
                        label: "Written Decisions",
                        summary: "Decisions are recorded in documents so context survives beyond the people in the room.",
                    },
                    {
                        id: "r2x2",
                        label: "Timezone Overlap",
                        summary: "Teams protect a few overlapping hours a day for conversations that need to be live.",
                    },
                    {
                        id: "r2x3",
                        label: "Meeting Debt",
                        summary: "Without discipline, asynchronous teams drift back into a calendar full of status meetings.",
                    },
                ],
                connections: [
                    { from: "r2", to: "r2x1", label: "relies on" },
                    { from: "r2", to: "r2x2", label: "requires" },
                    { from: "r2", to: "r2x3", label: "risks" },
                ],
            },
        },
    },
];
/** A fixture matches when the text mentions at least two of its keywords. */
function matchFixture(text) {
    const haystack = text.toLowerCase();
    let best;
    for (const fixture of exports.FIXTURES) {
        const hits = fixture.keywords.filter((k) => haystack.includes(k)).length;
        if (hits >= 2 && (!best || hits > best.hits))
            best = { fixture, hits };
    }
    return best?.fixture;
}
const titleCase = (value) => value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
const cleanWords = (value) => value.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
/** First `count` words of a phrase, title-cased, used as a node label. */
const labelFrom = (value, count, fallback) => {
    const words = cleanWords(value).split(/\s+/).filter(Boolean).slice(0, count);
    return words.length ? titleCase(words.join(" ")) : fallback;
};
const asSentence = (value) => {
    const trimmed = value.trim().replace(/\s+/g, " ").slice(0, 180);
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};
/** Split text into at most `count` roughly equal word chunks. */
const chunkWords = (text, count) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const size = Math.max(1, Math.ceil(words.length / count));
    const chunks = [];
    for (let i = 0; i < words.length; i += size) {
        chunks.push(words.slice(i, i + size).join(" "));
    }
    return chunks.slice(0, count);
};
/**
 * Deterministic fallback for mock mode: build a structurally valid mindmap out
 * of the text itself. Never as good as a real model, but it stays honest about
 * the input and it exercises the full validation path.
 */
function syntheticMindmap(text) {
    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 8);
    const units = sentences.length >= 4 ? sentences.slice(0, 8) : chunkWords(text, 5);
    const root = {
        id: "n1",
        label: labelFrom(text, 3, "Source Text"),
        summary: asSentence(sentences[0] ?? text.slice(0, 160)),
    };
    const children = units.map((unit, i) => ({
        id: `n${i + 2}`,
        label: labelFrom(unit, 3, `Idea ${i + 1}`),
        summary: asSentence(unit),
    }));
    return {
        title: `${labelFrom(text, 5, "Untitled Mindmap")} (mock)`,
        rootId: root.id,
        nodes: [root, ...children],
        connections: children.map((child) => ({
            from: root.id,
            to: child.id,
            label: "covers",
        })),
    };
}
/** Fallback drill-down when a fixture has no canned layer for this node. */
function syntheticExpansion(parent, idPrefix) {
    const facets = [
        { label: "Key Detail", verb: "detailed by" },
        { label: "Worked Example", verb: "illustrated by" },
        { label: "Known Caveat", verb: "limited by" },
    ];
    const nodes = facets.map((facet, i) => ({
        id: `${idPrefix}${i + 1}`,
        label: facet.label,
        summary: `A ${facet.label.toLowerCase()} expanding on "${parent.label}", generated in mock mode without calling a model.`,
    }));
    return {
        nodes,
        connections: nodes.map((node, i) => ({
            from: parent.id,
            to: node.id,
            label: facets[i].verb,
        })),
    };
}
