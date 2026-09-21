(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DrinkRadarXlsx = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const textEncoder = new TextEncoder();

  function xmlEscape(value, attribute = false) {
    const escaped = String(value ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    return attribute ? escaped.replaceAll('"', "&quot;").replaceAll("'", "&apos;") : escaped;
  }

  function columnName(index) {
    let value = index;
    let name = "";
    while (value > 0) {
      value -= 1;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }
    return name;
  }

  function displayWidth(value) {
    return [...String(value ?? "")].reduce((width, character) => width + (character.codePointAt(0) > 255 ? 2 : 1), 0);
  }

  function cellXml(value, reference, style = 0) {
    const styleAttribute = style ? ` s="${style}"` : "";
    if (typeof value === "number" && Number.isFinite(value)) {
      return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
    }
    const text = xmlEscape(value);
    return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
  }

  function buildWorksheet(headers, rows, options = {}) {
    const allRows = [headers, ...rows];
    const lastColumn = columnName(headers.length);
    const lastRow = Math.max(allRows.length, 1);
    const linkColumnIndex = headers.indexOf(options.linkHeader || "原帖链接");
    const relationships = [];
    const hyperlinkNodes = [];

    const rowNodes = allRows.map((row, rowIndex) => {
      const cells = headers.map((_, columnIndex) => {
        const value = row[columnIndex] ?? "";
        const reference = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
        const isHyperlink = rowIndex > 0 && columnIndex === linkColumnIndex && /^https?:\/\//i.test(String(value));
        if (isHyperlink) {
          const relationshipId = `rId${relationships.length + 1}`;
          relationships.push({ id: relationshipId, target: String(value) });
          hyperlinkNodes.push(`<hyperlink ref="${reference}" r:id="${relationshipId}"/>`);
        }
        return cellXml(value, reference, rowIndex === 0 ? 1 : isHyperlink ? 2 : 0);
      }).join("");
      return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="24" customHeight="1"' : ""}>${cells}</row>`;
    }).join("");

    const columns = headers.map((header, columnIndex) => {
      const values = allRows.map((row) => row[columnIndex] ?? "");
      const widest = Math.max(displayWidth(header), ...values.map(displayWidth));
      const preferred = columnIndex === linkColumnIndex ? 44 : Math.min(Math.max(widest + 2, 10), 34);
      return `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${preferred}" customWidth="1"/>`;
    }).join("");

    const hyperlinks = hyperlinkNodes.length ? `<hyperlinks>${hyperlinkNodes.join("")}</hyperlinks>` : "";
    const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columns}</cols>
  <sheetData>${rowNodes}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
  ${hyperlinks}
</worksheet>`;

    const relationshipXml = relationships.length ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relationships.map((relationship) => `  <Relationship Id="${relationship.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(relationship.target, true)}" TargetMode="External"/>`).join("\n")}
</Relationships>` : null;

    return { worksheet, relationshipXml };
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function writeUint16(view, offset, value) {
    view.setUint16(offset, value, true);
  }

  function writeUint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function zipTimestamp(date = new Date()) {
    const year = Math.max(date.getFullYear(), 1980);
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function concatBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }

  function createZip(files) {
    const localChunks = [];
    const centralChunks = [];
    const timestamp = zipTimestamp();
    let localOffset = 0;

    for (const file of files) {
      const name = textEncoder.encode(file.name);
      const data = file.data instanceof Uint8Array ? file.data : textEncoder.encode(String(file.data));
      const checksum = crc32(data);

      const localHeader = new Uint8Array(30);
      const localView = new DataView(localHeader.buffer);
      writeUint32(localView, 0, 0x04034B50);
      writeUint16(localView, 4, 20);
      writeUint16(localView, 6, 0x0800);
      writeUint16(localView, 8, 0);
      writeUint16(localView, 10, timestamp.time);
      writeUint16(localView, 12, timestamp.date);
      writeUint32(localView, 14, checksum);
      writeUint32(localView, 18, data.length);
      writeUint32(localView, 22, data.length);
      writeUint16(localView, 26, name.length);
      writeUint16(localView, 28, 0);
      localChunks.push(localHeader, name, data);

      const centralHeader = new Uint8Array(46);
      const centralView = new DataView(centralHeader.buffer);
      writeUint32(centralView, 0, 0x02014B50);
      writeUint16(centralView, 4, 20);
      writeUint16(centralView, 6, 20);
      writeUint16(centralView, 8, 0x0800);
      writeUint16(centralView, 10, 0);
      writeUint16(centralView, 12, timestamp.time);
      writeUint16(centralView, 14, timestamp.date);
      writeUint32(centralView, 16, checksum);
      writeUint32(centralView, 20, data.length);
      writeUint32(centralView, 24, data.length);
      writeUint16(centralView, 28, name.length);
      writeUint16(centralView, 30, 0);
      writeUint16(centralView, 32, 0);
      writeUint16(centralView, 34, 0);
      writeUint16(centralView, 36, 0);
      writeUint32(centralView, 38, 0);
      writeUint32(centralView, 42, localOffset);
      centralChunks.push(centralHeader, name);

      localOffset += localHeader.length + name.length + data.length;
    }

    const centralDirectory = concatBytes(centralChunks);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    writeUint32(endView, 0, 0x06054B50);
    writeUint16(endView, 4, 0);
    writeUint16(endView, 6, 0);
    writeUint16(endView, 8, files.length);
    writeUint16(endView, 10, files.length);
    writeUint32(endView, 12, centralDirectory.length);
    writeUint32(endView, 16, localOffset);
    writeUint16(endView, 20, 0);

    return concatBytes([...localChunks, centralDirectory, endRecord]);
  }

  function createWorkbookBytes(headers, rows, options = {}) {
    if (!Array.isArray(headers) || !headers.length) throw new TypeError("导出表头不能为空");
    if (!Array.isArray(rows)) throw new TypeError("导出数据必须为数组");

    const sheetName = String(options.sheetName || "当前筛选").slice(0, 31).replace(/[\\/?*\[\]:]/g, " ") || "Sheet1";
    const { worksheet, relationshipXml } = buildWorksheet(headers, rows, options);
    const files = [
      {
        name: "[Content_Types].xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
      },
      {
        name: "_rels/.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
      },
      {
        name: "xl/workbook.xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlEscape(sheetName, true)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
      },
      {
        name: "xl/styles.xml",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="Aptos"/><family val="2"/></font>
    <font><u/><color rgb="FF0563C1"/><sz val="11"/><name val="Aptos"/><family val="2"/></font>
  </fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9EEF6"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
      },
      { name: "xl/worksheets/sheet1.xml", data: worksheet }
    ];

    if (relationshipXml) files.push({ name: "xl/worksheets/_rels/sheet1.xml.rels", data: relationshipXml });
    return createZip(files);
  }

  function createWorkbookBlob(headers, rows, options = {}) {
    return new Blob([createWorkbookBytes(headers, rows, options)], { type: MIME_TYPE });
  }

  return { MIME_TYPE, createWorkbookBlob, createWorkbookBytes };
});
