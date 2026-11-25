import React, { useEffect, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export default function PdfDocumentPage({ bytes, pageNumber, label }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let canceled = false;
    let task;
    let render;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (canceled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const standardFontDataUrl = new URL(`${import.meta.env.BASE_URL}pdf-standard-fonts/`, document.baseURI).href;
        task = pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl });
        const pdf = await task.promise;
        if (canceled) return;
        const page = await pdf.getPage(pageNumber);
        if (canceled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = canvasRef.current;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        render = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        await render.promise;
        if (!canceled) setLoading(false);
      } catch (failure) {
        if (!canceled) { setError(failure.message || 'PDF 페이지를 표시하지 못했습니다.'); setLoading(false); }
      }
    })();
    return () => { canceled = true; render?.cancel(); task?.destroy(); };
  }, [bytes, pageNumber]);
  return <>
    {loading && <div className="document-library-state" role="status"><span className="document-library-spinner" /><p>PDF 페이지를 표시하고 있습니다.</p></div>}
    {error && <div className="document-library-state" role="alert"><h3>페이지를 표시하지 못했습니다</h3><p>{error}</p></div>}
    <canvas ref={canvasRef} hidden={loading || Boolean(error)} className="application-preview-paper" role="img" aria-label={label} />
  </>;
}
