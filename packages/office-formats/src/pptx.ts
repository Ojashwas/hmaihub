import type { LoadResult, PresentationModel, SlideModel } from "./models.ts";
import { buildPackage, NS_REL, OpcPackage, relationshipsXml, REL_OFFICE_DOCUMENT } from "./opc.ts";
import { descendants, element, elements, escapeXml, textContent, XML_DECLARATION, type XmlElement } from "./xml.ts";

const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const NS = `xmlns:a="${A}" xmlns:r="${NS_REL}" xmlns:p="${P}"`;
const CT = {
  presentation: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  presentationM: "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml",
  template: "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml",
  slideshow: "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml",
  slide: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
  layout: "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml",
  master: "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml",
  theme: "application/vnd.openxmlformats-officedocument.theme+xml",
  presProps: "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml",
  tableStyles: "application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"
};
const REL = (t: string) => `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${t}`;

export function readPptx(bytes: Uint8Array): LoadResult<PresentationModel> {
  const pkg = new OpcPackage(bytes);
  const main = pkg.mainPart();
  const type = pkg.overrides.get(main.toLowerCase());
  const warnings = new Set<string>();
  if (type === CT.presentationM)
    warnings.add("Macros (VBA) are not kept; the file will be saved as a macro-free .pptx");
  else if (type !== CT.presentation && type !== CT.template && type !== CT.slideshow) {
    throw new Error("This file is not a PowerPoint presentation");
  }
  warnings.add("Themes, layouts, and slide design are replaced by the HyperDeck design on save");
  const rels = pkg.relationships(main);
  const slides: SlideModel[] = [];
  for (const id of elements(element(pkg.xml(main), "p:sldIdLst"), "p:sldId")) {
    const rel = rels.find((r) => r.id === id.attrs["r:id"]);
    if (!rel) continue;
    const slide = pkg.xml(rel.target);
    if (!slide) continue;
    const tree = element(element(slide, "p:cSld"), "p:spTree");
    if (!tree) continue;
    if (descendants(tree, "p:pic").length) warnings.add("Pictures");
    if (descendants(tree, "p:graphicFrame").length) warnings.add("Tables, charts, and SmartArt");
    if (element(slide, "p:transition") || element(slide, "p:timing")) warnings.add("Transitions and animations");
    if (pkg.relationships(rel.target).some((r) => r.type === REL("notesSlide"))) warnings.add("Speaker notes");

    let title = "";
    const bullets: string[] = [];
    let rtl = false;
    for (const sp of descendants(tree, "p:sp")) {
      const ph = descendants(sp, "p:ph")[0];
      const isTitle = ph !== undefined && ["title", "ctrTitle"].includes(ph.attrs["type"] ?? "");
      const paras = descendants(sp, "a:p");
      if (paras.some((p) => element(p, "a:pPr")?.attrs["rtl"] === "1")) rtl = true;
      const texts = paras.map(paragraphText).filter((t) => t.trim() !== "");
      if (isTitle && !title) title = texts.join(" ");
      else bullets.push(...texts);
    }
    slides.push(rtl ? { title, bullets, rtl } : { title, bullets });
  }
  if (slides.length === 0) slides.push({ title: "", bullets: [] });
  return { model: { kind: "presentation", slides }, warnings: [...warnings].sort() };
}

function paragraphText(p: XmlElement): string {
  return elements(p)
    .map((c) =>
      c.name === "a:r" || c.name === "a:fld" ? textContent(element(c, "a:t")) : c.name === "a:br" ? "\n" : ""
    )
    .join("");
}

const groupProps =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function placeholder(id: number, name: string, ph: string, spPr: string, body: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${spPr}</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${body}</p:txBody></p:sp>`;
}

const xfrm = (x: number, y: number, cx: number, cy: number) =>
  `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;

const emptyPara = '<a:p><a:endParaRPr lang="en-US"/></a:p>';

function textPara(text: string, rtl: boolean): string {
  const pPr = rtl ? '<a:pPr rtl="1" algn="r"/>' : "";
  const lang = rtl ? "ar-AE" : "en-US";
  return text
    ? `<a:p>${pPr}<a:r><a:rPr lang="${lang}" dirty="0"/><a:t>${escapeXml(text)}</a:t></a:r></a:p>`
    : `<a:p>${pPr}<a:endParaRPr lang="${lang}"/></a:p>`;
}

const MASTER = `${XML_DECLARATION}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${groupProps}${placeholder(
  2,
  "Title Placeholder 1",
  '<p:ph type="title"/>',
  xfrm(838200, 365125, 10515600, 1325563),
  emptyPara
)}${placeholder(3, "Text Placeholder 2", '<p:ph type="body" idx="1"/>', xfrm(838200, 1825625, 10515600, 4351338), emptyPara)}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="4000" b="1"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="228600" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="2400"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;

const LAYOUT = `${XML_DECLARATION}<p:sldLayout ${NS} type="obj" preserve="1"><p:cSld name="Title and Content"><p:spTree>${groupProps}${placeholder(
  2,
  "Title 1",
  '<p:ph type="title"/>',
  "",
  emptyPara
)}${placeholder(3, "Content Placeholder 2", '<p:ph idx="1"/>', "", emptyPara)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
const THEME = `${XML_DECLARATION}<a:theme xmlns:a="${A}" name="HyperDeck"><a:themeElements><a:clrScheme name="HyperDeck"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="E5E7EB"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="DC2626"/></a:accent2><a:accent3><a:srgbClr val="16A34A"/></a:accent3><a:accent4><a:srgbClr val="D97706"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="1D4ED8"/></a:hlink><a:folHlink><a:srgbClr val="6D28D9"/></a:folHlink></a:clrScheme><a:fontScheme name="HyperDeck"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="HyperDeck"><a:fillStyleLst>${solid.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${`<a:ln w="6350">${solid}</a:ln>`.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${solid.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;

function slideXml(slide: SlideModel): string {
  const rtl = slide.rtl === true;
  const body = slide.bullets.length ? slide.bullets.map((b) => textPara(b, rtl)).join("") : emptyPara;
  return `${XML_DECLARATION}<p:sld ${NS}><p:cSld><p:spTree>${groupProps}${placeholder(
    2,
    "Title 1",
    '<p:ph type="title"/>',
    "",
    textPara(slide.title, rtl)
  )}${placeholder(3, "Content Placeholder 2", '<p:ph idx="1"/>', "", body)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export function writePptx(model: PresentationModel): Uint8Array {
  const slides = model.slides.length ? model.slides : [{ title: "", bullets: [] }];
  const presRels = [
    { id: "rId1", type: REL("slideMaster"), target: "slideMasters/slideMaster1.xml" },
    { id: "rId2", type: REL("theme"), target: "theme/theme1.xml" },
    { id: "rId3", type: REL("presProps"), target: "presProps.xml" },
    { id: "rId4", type: REL("tableStyles"), target: "tableStyles.xml" },
    ...slides.map((_, i) => ({ id: `rId${i + 5}`, type: REL("slide"), target: `slides/slide${i + 1}.xml` }))
  ];
  const sldIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 5}"/>`).join("");
  const presentation = `${XML_DECLARATION}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${sldIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  return buildPackage([
    {
      name: "_rels/.rels",
      data: relationshipsXml([{ id: "rId1", type: REL_OFFICE_DOCUMENT, target: "ppt/presentation.xml" }])
    },
    { name: "ppt/presentation.xml", contentType: CT.presentation, data: presentation },
    { name: "ppt/_rels/presentation.xml.rels", data: relationshipsXml(presRels) },
    { name: "ppt/presProps.xml", contentType: CT.presProps, data: `${XML_DECLARATION}<p:presentationPr ${NS}/>` },
    {
      name: "ppt/tableStyles.xml",
      contentType: CT.tableStyles,
      data: `${XML_DECLARATION}<a:tblStyleLst xmlns:a="${A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`
    },
    { name: "ppt/slideMasters/slideMaster1.xml", contentType: CT.master, data: MASTER },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      data: relationshipsXml([
        { id: "rId1", type: REL("slideLayout"), target: "../slideLayouts/slideLayout1.xml" },
        { id: "rId2", type: REL("theme"), target: "../theme/theme1.xml" }
      ])
    },
    { name: "ppt/slideLayouts/slideLayout1.xml", contentType: CT.layout, data: LAYOUT },
    {
      name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      data: relationshipsXml([{ id: "rId1", type: REL("slideMaster"), target: "../slideMasters/slideMaster1.xml" }])
    },
    { name: "ppt/theme/theme1.xml", contentType: CT.theme, data: THEME },
    ...slides.flatMap((s, i) => [
      { name: `ppt/slides/slide${i + 1}.xml`, contentType: CT.slide, data: slideXml(s) },
      {
        name: `ppt/slides/_rels/slide${i + 1}.xml.rels`,
        data: relationshipsXml([{ id: "rId1", type: REL("slideLayout"), target: "../slideLayouts/slideLayout1.xml" }])
      }
    ])
  ]);
}
