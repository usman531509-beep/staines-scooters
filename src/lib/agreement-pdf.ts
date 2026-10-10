/** Browser-only PDF exporter, loaded on demand. Preserves the entire document and signatures. */
export async function downloadAgreementPdf(element: HTMLElement, title: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setProperties({ title });
  let y = 15;
  const bottom = 280;
  const room = (height: number) => { if (y + height > bottom) { pdf.addPage(); y = 15; } };
  const text = (value: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(value.replace(/·/g, " - "), 180) as string[];
    for (const line of lines) { room(size * 0.45); pdf.text(line, 15, y); y += size * 0.45; }
    y += 2;
  };
  for (const child of Array.from(element.children)) {
    if (child.tagName === "TABLE") {
      const table = child as HTMLTableElement;
      const schedule = Boolean(table.tHead);
      if (!schedule) { for (const row of Array.from(table.rows)) text(Array.from(row.cells).map((c) => c.innerText).join(": "), 9); continue; }
      const widths = [8, 27, 29, 29, 29, 29, 29];
      for (const row of Array.from(table.rows)) {
        room(7); pdf.setFontSize(8); pdf.setFont("helvetica", row.parentElement?.tagName === "THEAD" ? "bold" : "normal");
        let x = 15;
        for (const [i, cell] of Array.from(row.cells).entries()) { pdf.text(cell.innerText, x, y); x += widths[i] ?? 25; }
        y += 6;
      }
      y += 3;
    } else if (child.querySelector("img") || child.textContent?.includes("Signature of customer")) {
      for (const block of Array.from(child.children)) {
        room(38);
        const image = block.querySelector("img");
        const first = block.firstElementChild;
        if (first) text(first.textContent ?? "", 10, true);
        if (image) { pdf.addImage(image.src, "PNG", 15, y, 65, 18); y += 21; }
        const last = block.lastElementChild;
        if (last && last !== first) text(last.textContent ?? "", 9);
      }
    } else {
      const size = parseFloat((child as HTMLElement).style.fontSize || "12");
      text(child.textContent ?? "", size >= 18 ? 14 : size >= 14 ? 12 : 9, size >= 14);
    }
  }
  pdf.save(`${title.replace(/[^a-zA-Z0-9 _-]/g, "").trim()}.pdf`);
}