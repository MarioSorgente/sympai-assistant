import { NextResponse } from "next/server";
import { Client as Notion } from "@notionhq/client";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;

const notion = new Notion({ auth: NOTION_TOKEN });

// cache between invocations (serverless warm starts)
let cache = null;
let lastBuilt = 0;

async function pageTitle(pageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const props = page.properties || {};
    for (const key of Object.keys(props)) {
      const p = props[key];
      if (p?.type === "title" && Array.isArray(p.title)) {
        const t = p.title.map(x => x.plain_text).join("");
        if (t) return t;
      }
    }
  } catch {}
  return "Notion Page";
}

async function fetchBlocksText(pageId) {
  let cursor = null;
  const lines = [];
  do {
    const resp = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor || undefined
    });
    for (const b of resp.results || []) {
      const t = b.type;
      const node = b[t];
      const rich = node?.rich_text || node?.text || node?.title;
      if (Array.isArray(rich) && rich.length) {
        lines.push(rich.map(x => x.plain_text).join(""));
      } else if (Array.isArray(node?.title) && node.title.length) {
        lines.push(node.title.map(x => x.plain_text).join(""));
      }
    }
    cursor = resp.has_more ? resp.next_cursor : null;
  } while (cursor);
  return lines.join("\n");
}

// discover ALL accessible pages (you controlled access in Notion UI)
async function discoverPageIds(limit = 20) {
  const results = [];
  let cursor = undefined;
  while (results.length < limit) {
    const res = await notion.search({
      query: "",
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      start_cursor: cursor,
      page_size: 50
    });
    (res.results || []).forEach(r => {
      if (r.object === "page" && results.length < limit) results.push(r.id);
    });
    if (!res.has_more) break;
    cursor = res.next_cursor;
  }
  if (!results.length) throw new Error("No pages found. Ensure the integration has Access to pages in Notion.");
  return results;
}

function buildPrompt(context, question) {
  return `You are SympAI, a precise copilot for Technical Sales Engineers (TSEs).
Answer clearly and practically using ONLY the provided context. Prefer step-by-step instructions.
If info is missing, say what's missing and propose next steps. Be concise.

Context:
${context}

Question: ${question}

Answer:`;
}

async function ensureVectorStore() {
  const FRESH_MS = 10 * 60 * 1000;
  if (cache && Date.now() - lastBuilt < FRESH_MS) return cache;

  const pageIds = await discoverPageIds(20);

  const documents = [];
  const sources = {};

  for (const pid of pageIds) {
    const text = await fetchBlocksText(pid);
    const title = await pageTitle(pid);
    const url = `https://www.notion.so/${pid.replace(/-/g, "")}`; // permalink
    sources[pid] = { title, url };
    if (text?.trim()) documents.push({ pageContent: text, metadata: { pid, title, url } });
  }

  if (!documents.length) throw new Error("No readable content found in shared pages.");

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 900, chunkOverlap: 200 });
  const chunks = await splitter.splitDocuments(documents);

  const embeddings = new OpenAIEmbeddings({ apiKey: OPENAI_API_KEY });
  const store = await MemoryVectorStore.fromDocuments(chunks, embeddings);

  cache = { store, sources };
  lastBuilt = Date.now();
  return cache;
}

export async function POST(req) {
  try {
    const question = await req.text();
    if (!question?.trim()) return new NextResponse("Empty question", { status: 400 });

    const { store, sources } = await ensureVectorStore();

    const results = await store.similaritySearch(question, 4);
    const context = results.map(r => r.pageContent).join("\n---\n");

    const llm = new ChatOpenAI({ apiKey: OPENAI_API_KEY, modelName: "gpt-4o-mini", temperature: 0 });
    const resp = await llm.invoke(buildPrompt(context, question));

    const uniq = new Map();
    for (const r of results) {
      const pid = r.metadata?.pid;
      if (pid && sources[pid] && !uniq.has(pid)) uniq.set(pid, sources[pid]);
    }

    return NextResponse.json({ answer: resp.content?.toString() ?? "No answer", sources: Array.from(uniq.values()) });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}

export const runtime = "nodejs";
