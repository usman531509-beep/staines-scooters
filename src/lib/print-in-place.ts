/**
 * Prints a printable page (receipt / invoice) without leaving the current tab:
 * the page loads in an off-screen frame and opens the print dialogue itself,
 * so the till stays on screen and no new tab opens.
 */
export function printInPlace(path: string) {
  document.getElementById("print-frame")?.remove();
  const frame = document.createElement("iframe");
  frame.id = "print-frame";
  frame.title = "Print";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:1100px;border:0;";
  frame.onload = () => {
    frame.contentWindow?.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 500));
  };
  frame.src = path;
  document.body.appendChild(frame);
}
