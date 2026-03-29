const BASE_URL = "https://api.edinet-fsa.go.jp/api/v2";

export interface EdinetDocument {
  seqNumber: number; docID: string; edinetCode: string|null; secCode: string|null;
  JCN: string|null; filerName: string|null; fundCode: string|null;
  ordinanceCode: string|null; formCode: string|null; docTypeCode: string|null;
  periodStart: string|null; periodEnd: string|null; submitDateTime: string|null;
  docDescription: string|null; issuerEdinetCode: string|null; subjectEdinetCode: string|null;
  subsidiaryEdinetCode: string|null; currentReportReason: string|null; parentDocID: string|null;
  opeDateTime: string|null; withdrawalStatus: string|null; docInfoEditStatus: string|null;
  disclosureStatus: string|null; xbrlFlag: string|null; pdfFlag: string|null;
  attachDocFlag: string|null; englishDocFlag: string|null; csvFlag: string|null; legalStatus: string|null;
}

export interface EdinetDocumentListResponse {
  metadata: { title: string; parameter: { date: string; type: string }; resultset: { count: number; date: string; totalCount: number; from: number; to: number } };
  results: EdinetDocument[];
}

export const DOC_TYPE_CODES: Record<string, string> = {
  "010":"有価証券通知書","020":"変更通知書（有価証券通知書）","030":"有価証券届出書",
  "040":"訂正有価証券届出書","050":"仮目論見書","060":"目論見書","070":"訂正目論見書",
  "100":"内部統制報告書","110":"訂正内部統制報告書","120":"有価証券報告書",
  "130":"訂正有価証券報告書","135":"確認書","136":"訂正確認書","140":"四半期報告書",
  "150":"訂正四半期報告書","160":"半期報告書","170":"訂正半期報告書","180":"臨時報告書",
  "190":"訂正臨時報告書","200":"親会社等状況報告書","210":"訂正親会社等状況報告書",
  "220":"自己株券買付状況報告書","230":"訂正自己株券買付状況報告書","235":"公開買付届出書",
  "236":"訂正公開買付届出書","237":"公開買付撤回届出書","238":"公開買付報告書",
  "239":"訂正公開買付報告書","240":"意見表明報告書","250":"訂正意見表明報告書",
  "260":"対質問回答報告書","270":"訂正対質問回答報告書","290":"発行登録書",
  "300":"訂正発行登録書","310":"発行登録追補書類","320":"訂正発行登録追補書類",
  "330":"発行登録撤回届出書","340":"大量保有報告書","350":"訂正大量保有報告書",
  "360":"基準日の届出書","370":"変更の届出書",
};

export async function getDocumentList(date: string, type: 1|2, apiKey: string): Promise<EdinetDocumentListResponse> {
  const res = await fetch(`${BASE_URL}/documents.json?date=${date}&type=${type}&Subscription-Key=${apiKey}`);
  if (!res.ok) throw new Error(`EDINET API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<EdinetDocumentListResponse>;
}

export async function getDocumentMetadata(docID: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/documents/${docID}?type=2&Subscription-Key=${apiKey}`);
  if (!res.ok) throw new Error(`EDINET API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function searchDocumentsByDateRange(startDate: string, endDate: string, docTypeCode: string|null, companyName: string|null, apiKey: string): Promise<EdinetDocument[]> {
  const results: EdinetDocument[] = [];
  const start = new Date(startDate), end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime()-start.getTime())/(1000*60*60*24));
  if (diffDays > 30) throw new Error("Date range cannot exceed 30 days");
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    try {
      const data = await getDocumentList(dateStr, 2, apiKey);
      let docs = data.results || [];
      if (docTypeCode) docs = docs.filter(d => d.docTypeCode === docTypeCode);
      if (companyName) { const l = companyName.toLowerCase(); docs = docs.filter(d => d.filerName?.toLowerCase().includes(l)); }
      results.push(...docs);
      await new Promise(r => setTimeout(r, 500));
    } catch {}
    current.setDate(current.getDate()+1);
  }
  return results;
}

export function formatDocument(doc: EdinetDocument): string {
  const lines = [
    `📄 書類ID: ${doc.docID}`,
    `🏢 提出者: ${doc.filerName||"N/A"}`,
    `📋 書類種別: ${doc.docTypeCode ? (DOC_TYPE_CODES[doc.docTypeCode]||doc.docTypeCode) : "N/A"}`,
    `📅 提出日時: ${doc.submitDateTime||"N/A"}`,
    `📆 対象期間: ${doc.periodStart||"N/A"} ～ ${doc.periodEnd||"N/A"}`,
  ];
  if (doc.edinetCode) lines.push(`🔑 EDINETコード: ${doc.edinetCode}`);
  if (doc.secCode) lines.push(`📊 証券コード: ${doc.secCode}`);
  if (doc.docDescription) lines.push(`📝 書類概要: ${doc.docDescription}`);
  const flags = [];
  if (doc.xbrlFlag==="1") flags.push("XBRL");
  if (doc.pdfFlag==="1") flags.push("PDF");
  if (doc.csvFlag==="1") flags.push("CSV");
  if (doc.englishDocFlag==="1") flags.push("English");
  if (flags.length>0) lines.push(`📁 利用可能形式: ${flags.join(", ")}`);
  return lines.join("\n");
}
