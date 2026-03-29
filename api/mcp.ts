import {
  getDocumentList,
  getDocumentMetadata,
  searchDocumentsByDateRange,
  formatDocument,
  DOC_TYPE_CODES,
} from "../src/edinet-client";

const EDINET_API_KEY = process.env.EDINET_API_KEY || "";

const TOOLS = [
  { name: "get_api_key_status", description: "EDINET APIキーが設定されているか確認します", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "list_document_types", description: "EDINETの書類種別コードと名称の一覧を返します", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "get_document_list", description: "指定した日付のEDINET提出書類一覧を取得します", inputSchema: { type: "object", properties: { date: { type: "string" }, type: { type: "string", enum: ["1","2"], default: "2" }, doc_type_code: { type: "string" }, company_name: { type: "string" }, limit: { type: "number", default: 20 } }, required: ["date"] } },
  { name: "search_documents", description: "日付範囲・企業名・書類種別でEDINET提出書類を横断検索します（最大30日間）", inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" }, doc_type_code: { type: "string" }, company_name: { type: "string" }, limit: { type: "number", default: 10 } }, required: ["start_date","end_date"] } },
  { name: "get_document_info", description: "書類IDを指定してEDINET書類のメタデータを取得します", inputSchema: { type: "object", properties: { doc_id: { type: "string" } }, required: ["doc_id"] } },
  { name: "get_recent_securities_reports", description: "直近N日間に提出された有価証券報告書を取得します", inputSchema: { type: "object", properties: { days: { type: "number", default: 7 }, company_name: { type: "string" }, limit: { type: "number", default: 10 } }, required: [] } },
];

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  if (!EDINET_API_KEY) return "❌ サーバーにEDINET_API_KEYが設定されていません。";
  switch (name) {
    case "get_api_key_status": return `✅ APIキー設定済み（末尾4桁: ...${EDINET_API_KEY.slice(-4)})`;
    case "list_document_types": return "📋 書類種別一覧\n\n" + Object.entries(DOC_TYPE_CODES).map(([c,n]) => `${c}: ${n}`).join("\n");
    case "get_document_list": {
      const data = await getDocumentList(args.date as string, args.type === "1" ? 1 : 2, EDINET_API_KEY);
      let results = data.results || [];
      if (args.doc_type_code) results = results.filter(d => d.docTypeCode === args.doc_type_code);
      if (args.company_name) { const l = (args.company_name as string).toLowerCase(); results = results.filter(d => d.filerName?.toLowerCase().includes(l)); }
      const limited = results.slice(0, (args.limit as number) || 20);
      return `📅 ${args.date} の書類一覧\n📊 ${results.length}件 / 表示: ${limited.length}件\n\n` + limited.map(formatDocument).join("\n\n──────────────────────────────────────────────────\n\n");
    }
    case "search_documents": {
      const results = await searchDocumentsByDateRange(args.start_date as string, args.end_date as string, (args.doc_type_code as string)||null, (args.company_name as string)||null, EDINET_API_KEY);
      const limited = results.slice(0, (args.limit as number)||10);
      return `🔍 ${args.start_date}～${args.end_date}\n📊 ${results.length}件 / 表示: ${limited.length}件\n\n` + limited.map(formatDocument).join("\n\n──────────────────────────────────────────────────\n\n");
    }
    case "get_document_info": {
      const data = await getDocumentMetadata(args.doc_id as string, EDINET_API_KEY);
      const base = `https://api.edinet-fsa.go.jp/api/v2/documents/${args.doc_id}`;
      return `📄 ${args.doc_id}\n\n${JSON.stringify(data,null,2)}\n\n📥 PDF: ${base}?type=2&Subscription-Key=YOUR_KEY`;
    }
    case "get_recent_securities_reports": {
      const days = (args.days as number)||7;
      const end = new Date(), start = new Date();
      start.setDate(end.getDate()-days);
      const fmt = (d: Date) => d.toISOString().split("T")[0];
      const results = await searchDocumentsByDateRange(fmt(start), fmt(end), "120", (args.company_name as string)||null, EDINET_API_KEY);
      const limited = results.slice(0, (args.limit as number)||10);
      return `📊 直近${days}日間の有価証券報告書\n📋 ${results.length}件 / 表示: ${limited.length}件\n\n` + limited.map(formatDocument).join("\n\n──────────────────────────────────────────────────\n\n");
    }
    default: return `Unknown tool: ${name}`;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const body = req.body;
  if (body.method === "initialize") return res.json({ jsonrpc:"2.0", id:body.id, result:{ protocolVersion:"2024-11-05", capabilities:{tools:{}}, serverInfo:{name:"edinet-mcp-server",version:"1.0.0"} } });
  if (body.method === "tools/list") return res.json({ jsonrpc:"2.0", id:body.id, result:{tools:TOOLS} });
  if (body.method === "tools/call") {
    try {
      const text = await handleToolCall(body.params?.name||"", (body.params?.arguments||{}) as Record<string,unknown>);
      return res.json({ jsonrpc:"2.0", id:body.id, result:{content:[{type:"text",text}]} });
    } catch(err: any) {
      return res.json({ jsonrpc:"2.0", id:body.id, result:{content:[{type:"text",text:`❌ エラー: ${err.message}`}]} });
    }
  }
  return res.json({ jsonrpc:"2.0", id:body.id, error:{code:-32601,message:"Method not found"} });
}
