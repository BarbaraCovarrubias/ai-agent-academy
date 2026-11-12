from fastapi import APIRouter, Response, HTTPException
from server.batch_evaluator import BatchSummaryReport

report_router = APIRouter(prefix="/api/reports", tags=["Executive Reports"])

@report_router.post("/export-ragas-pdf")
async def export_ragas_pdf(report: BatchSummaryReport):
    try:
        rows_html = "".join(
            f"<tr><td>{r.test_id}</td><td>{r.query}</td><td>{int(r.faithfulness*100)}%</td><td>{r.status}</td></tr>"
            for r in report.results
        )
        html_doc = f"<html><body><h1>Reporte RAGAS ({report.timestamp})</h1><table border='1'>{rows_html}</table></body></html>"
        return Response(content=html_doc, media_type="text/html")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
