import { NextRequest, NextResponse } from "next/server";
import { Client as Notion } from "@notionhq/client";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

type Source = { title: string; url: string };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const NOTION_TOKEN = process.env.NOTION_TOKEN!;

const notion = new Notion({ auth: NOTION_TOKEN });

// cache between invocations
let cache: { store: MemoryVectorStore; sources: Record<string, Source> } | null = null;
let lastBuilt = 0;

async function getTitle(pageId: string) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const props = (page as any).properties || {};
    for (const key of Object.keys(props)) {
      const p = props[key];
      if (p?.type === "title" && Array.isArray(p.title)) {
        const t = p.title.map((x: any) => x.plain_text).join("");
        if (t) return t;
      }
    }
  } catch {}
  return "Notion Page";
}

// Read plain text from a page's top-level blocks (paginated)
async function fetchBlocksText(pageId: string): Promise<string> {
  let cursor: string | null = null;
  const lines: string[] = [];
  do {
    const { results, next_cursor, has_more } = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      start_cursor: cursor || undefined
    } as any);
    for (const b of results || []) {
      const t = (b as any).type;
      const node = (b as any)[t];
      const rich = node?.rich_text || node?.text || node?.title;
      if (Array.isArray(rich) && rich.length) {
        lines.push(rich.map((x: any) => x.plain_text).join(""));
      } else if (Array.isArray(node?.title) && node.title.length) {
        lines.push(node.title.map((x: any) => x.plain_text).join(""));
      }
    }
    cursor = has_more ? next_cursor : null;
  } while (cursor);
  return lines.join("\n");
}

// Discover ALL pages the integration can see (you already controlled access in Notion)
async function discoverAccessiblePageIds(limit = 20): Promise<string[]> {
  // empty query = list everything this integration can see
  const results: string[] = [];
  let cursor: string | undefined = undefined;

  while (results.length < limit) {
    const res = await notion.search({
      query: "",
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      start_cursor: cursor,
      page_size: 50
    } as any);

    (res.results || []).forEach((r: any) => {
      if (r.object === "page" && results.length < limit) results.push(r.id);
    });

    if (!(res as any).has_more) break;
    cursor = (res as any).next_cursor;
  }

  if (!results.length) {
    throw new Error("No pages found. Ensure the integration has been invited to pages in Notion → Access.");
  }
  return results;
}

function makePrompt(context: string, question: string) {
  return `You are SympAI, a precise copilot for Technical Sales Engineers (TSEs).
Answer clearly and practically using ONLY the provided context. Prefer step-by-step instructions for procedures.
If information is missing, say what's missing and propose next steps. Be concise.

Context:
${context}

Question: ${question}

Answer:`;
}

async function ensureVectorStore() {
  const FRESH_MS = 10 * 60 * 1000; // rebuild every 10 min
  if (cache && Date.now() - lastBuilt < FRESH_MS) return cache;

  const pageIds = await discoverAccessiblePageIds(20); // cap for PoC

  const documents: { pageContent: string; metadata: any }[] = [];
  const sources: Record<string, Source> = {};

  for (const pid of pageIds) {
    const text = await fetchBlocksText(pid);
    const title = await getTitle(pid);
    const url = `https://www.notion.so/${pid.replace(/-/g, "")}`; // generic permalink
    sources[pid] = { title, url };
    if (text?.trim()) {
      documents.push({ pageContent: text, metadata: { pid, title, url } });
    }
  }

  if (!documents.length) {
    throw new Error("No readable content found in shared pages.");
  }

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 900, chunkOverlap: 200 });
  const chunks = await splitter.splitDocuments(documents as any);

  const embeddings = new OpenAIEmbeddings({ apiKey: OPENAI_API_KEY });
  const store = await MemoryVectorStore.fromDocuments(chunks as any, embeddings);

  cache = { store, sources };
  lastBuilt = Date.now();
  return cache;
}

export async function POST(req: NextRequest) {
  try {
    const question = await req.text();
    if (!question?.trim()) return new NextResponse("Empty question", { status: 400 });

    const { store, sources } = await ensureVectorStore();

    const results = await store.similaritySearch(question, 4);
    const context = results.map(r => r.pageContent).join("\n---\n");

    const llm = new ChatOpenAI({ apiKey: OPENAI_API_KEY, modelName: "gpt-4o-mini", temperature: 0 });
    const ans = await llm.invoke(makePrompt(context, question));

    const uniq = new Map<string, Source>();
    results.forEach(r => {
      const pid = (r.metadata as any)?.pid;
      if (pid && sources[pid] && !uniq.has(pid)) uniq.set(pid, sources[pid]);
    });

    return NextResponse.json({ answer: ans.content?.toString() ?? "No answer", sources: Array.from(uniq.values()) });
  } catch (e) {
    console.error(e);
    return new NextResponse("Server error", { status: 500 });
  }
}

export const runtime = "nodejs";
